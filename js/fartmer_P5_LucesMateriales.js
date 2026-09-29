// Variables globales que van siempre
var renderer, scene, camera;
var cameraControls;
var cenital;            // camara de la vista miniatura (planta)
var L = 500;            // semilado de la zona vista en planta (suelo 1000x1000)

// Nodos del grafo de escena
var robot, base, brazo, antebrazo, mano, pinzaIz, pinzaDe;
var materialesRobot = [];   // materiales del robot (para el cambio alambrico/solido)

// Interfaz: valores que controla la GUI (angulos en grados)
var gui;
var controles = {
  giroBase:        0,     // [-180, 180] base sobre Y
  giroBrazo:       0,     // [-45, 45]   brazo sobre el eje de la pieza 'eje'
  giroAntebrazoY:  0,     // [-180, 180] antebrazo sobre Y de la rotula
  giroAntebrazoZ:  0,     // [-90, 90]   antebrazo sobre el eje horizontal de la rotula
  giroPinza:       0,     // [-180, 0]  pinza sobre el eje de la mano
  separacionPinza: 8,     // [0, 15]     apertura de la pinza
  alambres:        false, // alambrico / solido
  animar:          animar // boton
};

// Movimiento con flechas
var PASO = 5;           // unidades por pulsacion
var LIMITE = 450;       // no salir del suelo (1000x1000)

// 1-inicializa
init();
// 2-Crea una escena
loadScene();
// 3-renderiza
render();

function init()
{
  renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setClearColor( new THREE.Color(0xFFFFFF) );
  // Sombras arrojadas
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('container').appendChild( renderer.domElement );

  scene = new THREE.Scene();

  // far = 2000 para que quepa la diagonal del suelo (1000x1000)
  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera( 50, aspectRatio , 0.1, 2000 );
  camera.position.set( 300, 300, 400 );

  // Control de camara con el raton
  //  - izquierdo: orbitar   - derecho: panning   - rueda: zoom
  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 100, 0 );
  cameraControls.mouseButtons = {
    LEFT:   THREE.MOUSE.ROTATE, // orbitar
    MIDDLE: THREE.MOUSE.DOLLY,  // zoom
    RIGHT:  THREE.MOUSE.PAN     // panning
  };
  cameraControls.screenSpacePanning = true;   // pan sobre el plano de la camara

  // Camara cenital (ortografica, cuadrada porque su viewport es cuadrado)
  cenital = new THREE.OrthographicCamera( -L, L, L, -L, 1, 1000 );
  cenital.position.set( 0, 600, 0 );
  cenital.up.set( 0, 0, -1 );     // -Z hacia arriba en la miniatura
  cenital.lookAt( 0, 0, 0 );

  // Limpiamos nosotros el buffer: se pintan dos vistas en el mismo canvas
  renderer.autoClear = false;

  // Flechas del teclado: mueven el robot sobre el suelo (plano XZ)
  window.addEventListener('keydown', moverRobot );

  crearLuces();
  crearGUI();

  window.addEventListener('resize', updateAspectRatio );
}

function loadScene()
{
  // ---------- Texturas ----------
  var loader = new THREE.TextureLoader();
  var path = 'images/';

  var texSuelo = loader.load( path + 'pisometalico_1024.jpg' );
  texSuelo.wrapS = texSuelo.wrapT = THREE.RepeatWrapping;
  texSuelo.repeat.set( 2, 2 );

  var texMetal  = loader.load( path + 'metal_128.jpg' );
  var texMadera = loader.load( path + 'wood512.jpg' );

  // Mapa de entorno (cubemap): mismas 6 imagenes que las paredes de la habitacion
  // Cubemap propio (nave industrial), recortado de una imagen en cruz
  var paredes = [ 'nave/px.jpg', 'nave/nx.jpg', 'nave/py.jpg', 'nave/ny.jpg', 'nave/pz.jpg', 'nave/nz.jpg' ]; 
  var mapaEntorno = new THREE.CubeTextureLoader().setPath( path ).load( paredes );

  // ---------- Materiales ----------
  // Lambert = mate (solo difusa)   Phong = brillante (difusa + especular)
  var matSuelo     = new THREE.MeshLambertMaterial( { map: texSuelo } );
  var matMetal     = new THREE.MeshPhongMaterial  ( { map: texMetal, specular: 0x999999, shininess: 60 } );
  var matMadera    = new THREE.MeshLambertMaterial( { map: texMadera } );
  var matPinza     = new THREE.MeshPhongMaterial  ( { map: texMetal, color: 0xffcc66, specular: 0xffffff, shininess: 100 } );
  // Rotula y mano: metalizado que refleja el entorno (la habitacion)
  var matRotula    = new THREE.MeshPhongMaterial  ( { color: 0xffffff, specular: 0xffffff, shininess: 100,
                                                      envMap: mapaEntorno, reflectivity: 1 } );

  materialesRobot = [ matMetal, matMadera, matPinza, matRotula ];

  // ---------- Habitacion ----------
  // Cubo con un material por cara, texturas vistas desde dentro (BackSide).
  // Orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z (el mismo que el cubemap)
  var matHabitacion = [];
  for ( var i = 0; i < paredes.length; i++ )
    matHabitacion.push( new THREE.MeshBasicMaterial( { map: loader.load( path + paredes[i] ), side: THREE.BackSide } ) );
  var habitacion = new THREE.Mesh( new THREE.BoxGeometry( 1000, 1000, 1000 ), matHabitacion );
  habitacion.position.y = 499;     // el suelo de la habitacion queda justo debajo del suelo texturado
  scene.add( habitacion );

  // ---------- Suelo ----------
  var suelo = new THREE.Mesh( new THREE.PlaneGeometry( 1000, 1000, 10, 10 ), matSuelo );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  scene.add( suelo );

  // ---------- Robot (mismo grafo que en P2-P4) ----------
  robot = new THREE.Object3D();

  var altoBase = 15;
  base = new THREE.Mesh( new THREE.CylinderGeometry( 50, 50, altoBase, 40 ), matMetal );
  base.position.y = altoBase / 2;
  robot.add( base );

  brazo = new THREE.Object3D();
  brazo.position.y = altoBase / 2;
  base.add( brazo );

  var eje = new THREE.Mesh( new THREE.CylinderGeometry( 20, 20, 18, 30 ), matMadera );
  eje.rotation.z = Math.PI / 2;
  brazo.add( eje );

  var esparrago = new THREE.Mesh( new THREE.BoxGeometry( 18, 120, 12 ), matMetal );
  esparrago.position.y = 60;
  brazo.add( esparrago );

  var rotula = new THREE.Mesh( new THREE.SphereGeometry( 20, 30, 30 ), matRotula );
  rotula.position.y = 120;
  brazo.add( rotula );

  antebrazo = new THREE.Object3D();
  antebrazo.position.y = 120;
  brazo.add( antebrazo );

  var disco = new THREE.Mesh( new THREE.CylinderGeometry( 22, 22, 6, 30 ), matMadera );
  antebrazo.add( disco );

  var nervios = new THREE.Object3D();
  var geometriaNervio = new THREE.BoxGeometry( 4, 80, 4 );
  var sepNervios = 10;
  var posiciones = [
    [  sepNervios,  sepNervios ],
    [ -sepNervios,  sepNervios ],
    [  sepNervios, -sepNervios ],
    [ -sepNervios, -sepNervios ]
  ];
  for ( var i = 0; i < posiciones.length; i++ )
  {
    var nervio = new THREE.Mesh( geometriaNervio, matMetal );
    nervio.position.set( posiciones[i][0], 40, posiciones[i][1] );
    nervios.add( nervio );
  }
  antebrazo.add( nervios );

  var geometriaMano = new THREE.CylinderGeometry( 15, 15, 40, 30 );
  geometriaMano.rotateZ( Math.PI / 2 );
  mano = new THREE.Mesh( geometriaMano, matRotula );
  mano.position.y = 80;
  antebrazo.add( mano );

  var sepDedos = 10;
  var zDedos = 20;

  pinzaIz = crearDedo( matPinza );
  pinzaIz.position.set( -sepDedos, 0, zDedos );
  mano.add( pinzaIz );

  pinzaDe = pinzaIz.clone();
  pinzaDe.position.set( sepDedos, 0, zDedos );
  pinzaDe.scale.x = -1;
  mano.add( pinzaDe );

  // Todas las piezas del robot arrojan y reciben sombras
  robot.traverse( function( nodo ) {
    if ( nodo.isMesh ) { nodo.castShadow = true; nodo.receiveShadow = true; }
  } );

  scene.add( robot );
}

// Luces: ambiental + direccional + focal (las dos ultimas con sombras)
function crearLuces()
{
  var ambiental = new THREE.AmbientLight( 0xffffff, 0.25 );
  scene.add( ambiental );

  var direccional = new THREE.DirectionalLight( 0xffffff, 0.5 );
  direccional.position.set( -300, 500, 200 );
  direccional.castShadow = true;
  // la camara de sombras de la direccional es ortografica: que cubra el suelo
  direccional.shadow.camera.left   = -500;
  direccional.shadow.camera.right  =  500;
  direccional.shadow.camera.top    =  500;
  direccional.shadow.camera.bottom = -500;
  direccional.shadow.camera.far    = 1500;
  direccional.shadow.mapSize.set( 2048, 2048 );
  scene.add( direccional );

  var focal = new THREE.SpotLight( 0xffffff, 0.7 );
  focal.position.set( 300, 600, 300 );
  focal.target.position.set( 0, 0, 0 );
  focal.angle = Math.PI / 6;
  focal.penumbra = 0.3;
  focal.castShadow = true;
  focal.shadow.camera.near = 100;
  focal.shadow.camera.far  = 1500;
  focal.shadow.mapSize.set( 2048, 2048 );
  scene.add( focal );
  scene.add( focal.target );
}

// Dedo: paralelepipedo de 4x20x19 que se pega a la mano + cuna.
// El origen esta en la union de las dos partes (z = 0)
function crearDedo( material )
{
  var dedo = new THREE.Object3D();

  var soporte = new THREE.Mesh( new THREE.BoxGeometry( 4, 20, 19 ), material );
  soporte.position.z = -19 / 2;
  dedo.add( soporte );

  dedo.add( new THREE.Mesh( crearGeometriaCuna(), material ) );
  return dedo;
}

// Cuna de 19 de largo en Z: base de 4x20 (z = 0) y punta de 2x10 (z = 19).
// La cara x = 2 es plana y la de x < 0 es la inclinada
function crearGeometriaCuna()
{
  // vertices: 0-3 en la base, 4-7 en la punta
  var v = [
    new THREE.Vector3( -2, -10,  0 ),   // 0
    new THREE.Vector3(  2, -10,  0 ),   // 1
    new THREE.Vector3(  2,  10,  0 ),   // 2
    new THREE.Vector3( -2,  10,  0 ),   // 3
    new THREE.Vector3(  0,  -5, 19 ),   // 4
    new THREE.Vector3(  2,  -5, 19 ),   // 5
    new THREE.Vector3(  2,   5, 19 ),   // 6
    new THREE.Vector3(  0,   5, 19 )    // 7
  ];

  // caras (cuadrilateros en sentido antihorario visto desde fuera)
  var caras = [
    [ 0, 3, 2, 1 ],   // base
    [ 4, 5, 6, 7 ],   // punta
    [ 1, 2, 6, 5 ],   // interior
    [ 0, 4, 7, 3 ],   // exterior
    [ 0, 1, 5, 4 ],   // inferior
    [ 3, 7, 6, 2 ]    // superior
  ];

  // coordenadas de textura de las 4 esquinas de cada cara
  var uvCara = [ [0,0], [1,0], [1,1], [0,1] ];

  var posiciones = [];
  var normales = [];
  var uvs = [];

  for ( var i = 0; i < caras.length; i++ )
  {
    var c = caras[i];

    // normal de la cara = producto vectorial de dos aristas
    var n = new THREE.Vector3()
      .subVectors( v[c[1]], v[c[0]] )
      .cross( new THREE.Vector3().subVectors( v[c[2]], v[c[0]] ) )
      .normalize();

    // dos triangulos por cara (indices 0..3 de la cara)
    var tri = [ 0, 1, 2, 0, 2, 3 ];
    for ( var j = 0; j < tri.length; j++ )
    {
      var p = v[c[tri[j]]];
      posiciones.push( p.x, p.y, p.z );
      normales.push( n.x, n.y, n.z );
      uvs.push( uvCara[tri[j]][0], uvCara[tri[j]][1] );
    }
  }

  var geometria = new THREE.BufferGeometry();
  geometria.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( posiciones ), 3 ) );
  geometria.setAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( normales ), 3 ) );
  geometria.setAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( uvs ), 2 ) );
  return geometria;
}

// Interfaz lil-gui: una barra por articulacion, checkbox y boton
function crearGUI()
{
  gui = new lil.GUI( { title: 'Control Robot' } );

  gui.add( controles, 'giroBase', -180, 180, 1 ).name( 'Giro Base' ).listen();
  gui.add( controles, 'giroBrazo', -45, 45, 1 ).name( 'Giro Brazo' ).listen();
  gui.add( controles, 'giroAntebrazoY', -180, 180, 1 ).name( 'Giro Antebrazo Y' ).listen();
  gui.add( controles, 'giroAntebrazoZ', -90, 90, 1 ).name( 'Giro Antebrazo Z' ).listen();
  gui.add( controles, 'giroPinza', -180, 0, 1 ).name( 'Giro Pinza' ).listen();
  gui.add( controles, 'separacionPinza', 0, 15, 0.1 ).name( 'Separacion Pinza' ).listen();
  gui.add( controles, 'alambres' ).name( 'Alambres' )
     .onChange( function( valor ) {
       materialesRobot.forEach( function( m ) { m.wireframe = valor; } );
     } );
  gui.add( controles, 'animar' ).name( 'Anima' );
}

// Flechas: el robot se desplaza en X y Z sin salir del suelo
function moverRobot( event )
{
  switch ( event.code )
  {
    case 'ArrowUp':    robot.position.z -= PASO; break;
    case 'ArrowDown':  robot.position.z += PASO; break;
    case 'ArrowLeft':  robot.position.x -= PASO; break;
    case 'ArrowRight': robot.position.x += PASO; break;
    default: return;
  }
  robot.position.x = THREE.MathUtils.clamp( robot.position.x, -LIMITE, LIMITE );
  robot.position.z = THREE.MathUtils.clamp( robot.position.z, -LIMITE, LIMITE );
}

// Animacion con tween: se interpolan los valores de la GUI (y por tanto el robot)
// pose 1 -> pose 2 -> pose 3 -> reposo, encadenadas
function animar()
{
  TWEEN.removeAll();   // si se pulsa otra vez, empieza de nuevo

  var pose1  = { giroBase: 0,  giroBrazo: 45, giroAntebrazoY: 0,   giroAntebrazoZ: 61,
                 giroPinza: -34,  separacionPinza: 15 };
  var pose2  = { giroBase: 90, giroBrazo: 0,  giroAntebrazoY: 0,   giroAntebrazoZ: 45,
                 giroPinza: 0,    separacionPinza: 0 };
  var pose3  = { giroBase: 0,  giroBrazo: 0,  giroAntebrazoY: 180, giroAntebrazoZ: 0,
                 giroPinza: -180, separacionPinza: 8 };
  var reposo = { giroBase: 0,  giroBrazo: 0,  giroAntebrazoY: 0,   giroAntebrazoZ: 0,
                 giroPinza: 0,    separacionPinza: 8 };

  var suave = TWEEN.Easing.Quadratic.InOut;
  var t1 = new TWEEN.Tween( controles ).to( pose1,  2000 ).easing( suave );
  var t2 = new TWEEN.Tween( controles ).to( pose2,  2000 ).easing( suave );
  var t3 = new TWEEN.Tween( controles ).to( pose3,  2000 ).easing( suave );
  var t4 = new TWEEN.Tween( controles ).to( reposo, 2000 ).easing( suave );

  t1.chain( t2 );
  t2.chain( t3 );
  t3.chain( t4 );
  t1.start();
}

// Aplica los valores de la GUI a los nodos del grafo de escena.
// En este modelo el 'eje' y la 'mano' tienen su eje de revolucion en X local,
// por eso los giros "sobre el eje de la pieza" se hacen con rotation.x
function actualizarRobot()
{
  var rad = THREE.MathUtils.degToRad;

  base.rotation.y      = rad( controles.giroBase );
  brazo.rotation.x     = rad( controles.giroBrazo );
  antebrazo.rotation.y = rad( controles.giroAntebrazoY );
  antebrazo.rotation.x = rad( controles.giroAntebrazoZ );
  mano.rotation.x      = rad( controles.giroPinza );

  // separacion = hueco entre los dos dedos a cada lado del centro (dedo de 4 de grosor)
  var d = 2 + controles.separacionPinza;
  pinzaIz.position.x = -d;
  pinzaDe.position.x =  d;
}

// Al redimensionar solo cambia el aspecto de la camara general.
// La miniatura se recalcula en cada frame a partir de w y h y siempre es cuadrada.
function updateAspectRatio()
{
  renderer.setSize( window.innerWidth, window.innerHeight );
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function update()
{
  // Cambios para actualizar la camara segun mvto del raton
  cameraControls.update();

  // Avanza las animaciones activas y aplica los valores al robot
  TWEEN.update();
  actualizarRobot();
}

function render()
{
  requestAnimationFrame( render );
  update();

  var w = window.innerWidth;
  var h = window.innerHeight;

  // Vista general: ocupa todo el canvas
  renderer.setViewport( 0, 0, w, h );
  renderer.setClearColor( new THREE.Color(0xFFFFFF) );
  renderer.clear();
  renderer.render( scene, camera );

  // Vista miniatura cenital: esquina superior izquierda, lado = 1/4 del lado menor
  // (el origen del viewport es la esquina INFERIOR izquierda, por eso y = h - lado)
  var lado = Math.min( w, h ) / 4;
  renderer.setViewport( 0, h - lado, lado, lado );
  renderer.setScissor ( 0, h - lado, lado, lado );
  renderer.setScissorTest( true );
  renderer.setClearColor( new THREE.Color(0xDDDDDD) );
  renderer.clear();                 // solo borra el recuadro gracias al scissor
  renderer.render( scene, cenital );
  renderer.setScissorTest( false );
}