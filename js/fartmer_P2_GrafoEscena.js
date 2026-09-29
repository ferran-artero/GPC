// Variables globales que van siempre
var renderer, scene, camera;
var cameraControls;

// Nodos del grafo de escena
var robot, base, brazo, antebrazo, mano, pinzaIz, pinzaDe;

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

  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 100, 0 );

  window.addEventListener('resize', updateAspectRatio );
}

function loadScene()
{
  var material = new THREE.MeshNormalMaterial();
  var materialSuelo = new THREE.MeshBasicMaterial( { color: 'red', wireframe: true } );

  // Suelo 1000x1000 en el plano XZ
  var suelo = new THREE.Mesh( new THREE.PlaneGeometry( 1000, 1000, 10, 10 ), materialSuelo );
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

  // Ejes de ayuda (quitar al entregar)
  scene.add( new THREE.AxesHelper( 100 ) );
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

  var posiciones = [];
  var normales = [];

  for ( var i = 0; i < caras.length; i++ )
  {
    var c = caras[i];

    // normal de la cara = producto vectorial de dos aristas
    var n = new THREE.Vector3()
      .subVectors( v[c[1]], v[c[0]] )
      .cross( new THREE.Vector3().subVectors( v[c[2]], v[c[0]] ) )
      .normalize();

    // dos triangulos por cara
    var tri = [ c[0], c[1], c[2], c[0], c[2], c[3] ];
    for ( var j = 0; j < tri.length; j++ )
    {
      var p = v[tri[j]];
      posiciones.push( p.x, p.y, p.z );
      normales.push( n.x, n.y, n.z );
    }
  }

  var geometria = new THREE.BufferGeometry();
  geometria.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( posiciones ), 3 ) );
  geometria.setAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( normales ), 3 ) );
  return geometria;
}

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
}

function render()
{
  requestAnimationFrame( render );
  update();
  renderer.render( scene, camera );
}