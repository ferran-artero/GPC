// Variables globales que van siempre
var renderer, scene, camera;
var cameraControls;
var cenital;            // camara de la vista miniatura (planta)
var L = 500;            // semilado de la zona vista en planta (suelo 1000x1000)

// Nodos del grafo de escena
var robot, base, brazo, antebrazo, mano, pinzaIz, pinzaDe;
var material;           // material comun del robot (para el cambio alambrico/solido)

// Interfaz: valores que controla la GUI (angulos en grados)
var gui;
var controles = {
  giroBase:        0,     // [-180, 180] base sobre Y
  giroBrazo:       0,     // [-45, 45]   brazo sobre el eje de la pieza 'eje'
  giroAntebrazoY:  0,     // [-180, 180] antebrazo sobre Y de la rotula
  giroAntebrazoZ:  0,     // [-90, 90]   antebrazo sobre el eje horizontal de la rotula
  giroPinza:       0,     // [-40, 220]  pinza sobre el eje de la mano
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

  crearGUI();

  window.addEventListener('resize', updateAspectRatio );
}

function loadScene()
{
  material = new THREE.MeshNormalMaterial();
  var materialSuelo = new THREE.MeshBasicMaterial( { color: 'red', wireframe: true } );

  // Suelo 1000x1000 en el plano XZ
  var suelo = new THREE.Mesh( new THREE.PlaneGeometry( 1000, 1000, 10, 10 ), material );
  suelo.rotation.x = -Math.PI / 2;
  scene.add( suelo );

  // Robot y base (cilindro r=50, h=15 apoyado en el suelo)
  robot = new THREE.Object3D();

  var altoBase = 15;
  base = new THREE.Mesh( new THREE.CylinderGeometry( 50, 50, altoBase, 40 ), material );
  base.position.y = altoBase / 2;
  robot.add( base );

  // Brazo: eje, esparrago y rotula. Su origen esta sobre la cara superior de la base
  brazo = new THREE.Object3D();
  brazo.position.y = altoBase / 2;
  base.add( brazo );

  var eje = new THREE.Mesh( new THREE.CylinderGeometry( 20, 20, 18, 30 ), material );
  eje.rotation.z = Math.PI / 2;
  brazo.add( eje );

  var esparrago = new THREE.Mesh( new THREE.BoxGeometry( 18, 120, 12 ), material );
  esparrago.position.y = 60;
  brazo.add( esparrago );

  var rotula = new THREE.Mesh( new THREE.SphereGeometry( 20, 30, 30 ), material );
  rotula.position.y = 120;
  brazo.add( rotula );

  // Antebrazo: disco, nervios y mano. Su origen esta en el centro de la rotula
  antebrazo = new THREE.Object3D();
  antebrazo.position.y = 120;
  brazo.add( antebrazo );

  var disco = new THREE.Mesh( new THREE.CylinderGeometry( 22, 22, 6, 30 ), material );
  antebrazo.add( disco );

  // 4 nervios de 4x80x4 en las esquinas del disco (misma geometria para los cuatro)
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
    var nervio = new THREE.Mesh( geometriaNervio, material );
    nervio.position.set( posiciones[i][0], 40, posiciones[i][1] );
    nervios.add( nervio );
  }
  antebrazo.add( nervios );

  // Mano: cilindro r=15, h=40 tumbado con el eje en X.
  // Se gira la geometria y no el nodo para que las pinzas no hereden el giro
  var geometriaMano = new THREE.CylinderGeometry( 15, 15, 40, 30 );
  geometriaMano.rotateZ( Math.PI / 2 );
  mano = new THREE.Mesh( geometriaMano, material );
  mano.position.y = 80;
  antebrazo.add( mano );

  // Pinza: un dedo y su reflejo en X, pegados a la cara frontal de la mano
  var sepDedos = 10;
  var zDedos = 20;

  pinzaIz = crearDedo( material );
  pinzaIz.position.set( -sepDedos, 0, zDedos );
  mano.add( pinzaIz );

  pinzaDe = pinzaIz.clone();
  pinzaDe.position.set( sepDedos, 0, zDedos );
  pinzaDe.scale.x = -1;
  mano.add( pinzaDe );

  scene.add( robot );

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
  var geometria = new THREE.BufferGeometry();

  // Vertices sin indices: 6 caras x 2 triangulos x 3 vertices,
  // en sentido antihorario vistos desde fuera
  var vertices = new Float32Array([
    // Base (pegada al soporte, z = 0)
    -2, -10,  0,
    -2,  10,  0,
     2,  10,  0,
    -2, -10,  0,
     2,  10,  0,
     2, -10,  0,
    // Punta (z = 19)
     0,  -5, 19,
     2,  -5, 19,
     2,   5, 19,
     0,  -5, 19,
     2,   5, 19,
     0,   5, 19,
    // Cara interior (plana, x = 2)
     2, -10,  0,
     2,  10,  0,
     2,   5, 19,
     2, -10,  0,
     2,   5, 19,
     2,  -5, 19,
    // Cara exterior (inclinada)
    -2, -10,  0,
     0,  -5, 19,
     0,   5, 19,
    -2, -10,  0,
     0,   5, 19,
    -2,  10,  0,
    // Cara inferior
    -2, -10,  0,
     2, -10,  0,
     2,  -5, 19,
    -2, -10,  0,
     2,  -5, 19,
     0,  -5, 19,
    // Cara superior
    -2,  10,  0,
     0,   5, 19,
     2,   5, 19,
    -2,  10,  0,
     2,   5, 19,
     2,  10,  0
  ]);
  geometria.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );

  // Una normal por cara, repetida en sus 6 vertices.
  // Las caras inclinadas no miran a un eje: su normal sale del producto
  // vectorial de dos aristas: (-19,0,2) la exterior y (0,-76,20) la inferior
  // (la superior es simetrica), divididas por su modulo
  var normalesCara = [
    [  0,       0,      -1      ],   // base
    [  0,       0,       1      ],   // punta
    [  1,       0,       0      ],   // interior
    [ -0.9945,  0,       0.1047 ],   // exterior
    [  0,      -0.9671,  0.2545 ],   // inferior
    [  0,       0.9671,  0.2545 ]    // superior
  ];
  var normales = [];
  for ( var i = 0; i < normalesCara.length; i++ )
    for ( var j = 0; j < 6; j++ )
      normales.push( normalesCara[i][0], normalesCara[i][1], normalesCara[i][2] );
  geometria.setAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( normales ), 3 ) );

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
  gui.add( controles, 'giroPinza', -40, 220, 1 ).name( 'Giro Pinza' ).listen();
  gui.add( controles, 'separacionPinza', 0, 15, 0.1 ).name( 'Separacion Pinza' ).listen();
  gui.add( controles, 'alambres' ).name( 'Alambres' )
     .onChange( function( valor ) { material.wireframe = valor; } );
  gui.add( controles, 'animar' ).name( 'Anima' );
}

// Flechas: el robot se desplaza en X y Z sin salir del suelo
function moverRobot( event )
{
  switch ( event.code )
  {
    case 'ArrowUp':    robot.position.z += PASO; break;
    case 'ArrowDown':  robot.position.z -= PASO; break;
    case 'ArrowLeft':  robot.position.x += PASO; break;
    case 'ArrowRight': robot.position.x -= PASO; break;
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
                 giroPinza: 34,   separacionPinza: 15 };
  var pose2  = { giroBase: 90, giroBrazo: 0,  giroAntebrazoY: 0,   giroAntebrazoZ: 45,
                 giroPinza: 0,    separacionPinza: 0 };
  var pose3  = { giroBase: 0,  giroBrazo: 0,  giroAntebrazoY: 180, giroAntebrazoZ: 0,
                 giroPinza: 180,  separacionPinza: 8 };
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
  mano.rotation.x      = -rad( controles.giroPinza );   // positivo = la pinza sube

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