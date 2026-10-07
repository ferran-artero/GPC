// Proyecto Personal GPC - Rover de exploracion en Marte

// Variables globales que van siempre
var renderer, scene, camera;
var reloj = new THREE.Clock();

// Terreno (Victoria Crater, datos HiRISE). 1 unidad = 1 metro
var terreno, exterior;
var base, rover, rocas, muestras;
var alturas = null;           // heightmap: Uint16Array de 512x512
var TAM_MAPA  = 512;
var LADO      = 1036;         // metros por lado (512 px * 2.02 m/px)
var DESNIVEL  = 78.88;        // metros entre el punto mas bajo y el mas alto
var ALTURA_BORDE = 0.8371 * DESNIVEL;   // altura y color del llano exterior (victoria_info.json)
var COLOR_BORDE  = '#875b41';
var COLOR_CIELO  = '#c9926b';

// El jugador no puede alejarse mas que esto del centro (m)
var LIMITE = LADO / 2 - 20;

// Sol: la camara de sombras sigue a 'objetivoSombra' (la posicion del rover)
var sol;
var objetivoSombra = new THREE.Vector3();
var SOL_DIR = new THREE.Vector3( -0.6, 0.8, 0.4 ).normalize();
var SOMBRA_SEMILADO = 60;     // metros que cubre el mapa de sombras

// Camara (tecla C): 'tercera' (sigue al rover) o 'primera' (la del mastil, con deteccion)
var modoCamara = 'tercera';
var camaraPrimera;
var camTercera = { distancia: 6, altura: 3, suavizado: 4 };

// Minimapa: camara ortografica cenital que sigue al rover, en un segundo viewport
var camaraMini, marcadorRover;
var marcasMini = [];          // objetos que solo se dibujan en el minimapa
var MINI_SEMILADO = 60;       // metros desde el rover hasta el borde
var MINI_ALTURA = 150;
var MINI_MARGEN = 12;         // px

// 1-inicializa
init();
// 2-Crea una escena
loadScene();
// 3-renderiza
render();

function init()
{
  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setClearColor( new THREE.Color( COLOR_CIELO ) );
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;                          // hay dos vistas: se limpia a mano
  document.getElementById('container').appendChild( renderer.domElement );

  scene = new THREE.Scene();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera( 50, aspectRatio, 0.1, 5000 );
  camera.position.set( 0, 450, 750 );

  camaraMini = new THREE.OrthographicCamera( -MINI_SEMILADO, MINI_SEMILADO, MINI_SEMILADO, -MINI_SEMILADO, 1, 500 );
  camaraMini.up.set( 0, 0, -1 );

  // Flecha que marca la posicion y el rumbo del rover en el minimapa
  var forma = new THREE.Shape();
  forma.moveTo( 0, 6 ); forma.lineTo( -4, -5 ); forma.lineTo( 0, -2.5 ); forma.lineTo( 4, -5 );
  var geoFlecha = new THREE.ShapeGeometry( forma );
  geoFlecha.rotateX( Math.PI / 2 );                    // tumbada, con la punta hacia +Z
  marcadorRover = new THREE.Mesh( geoFlecha, new THREE.MeshBasicMaterial(
    { color: 0xe8dcc8, side: THREE.DoubleSide, fog: false, depthTest: false } ) );
  marcadorRover.renderOrder = 10;
  marcadorRover.visible = false;
  marcasMini.push( marcadorRover );
  // contorno oscuro para que destaque sobre el terreno
  var contorno = new THREE.Mesh( geoFlecha, new THREE.MeshBasicMaterial(
    { color: 0x2a1a12, side: THREE.DoubleSide, fog: false, depthTest: false } ) );
  contorno.scale.setScalar( 1.35 );
  contorno.position.z = -0.2;
  contorno.renderOrder = 9;
  marcadorRover.add( contorno );
  scene.add( marcadorRover );
  colocarMarcoMini();

  window.addEventListener( 'resize', updateAspectRatio );
  window.addEventListener( 'keydown', function( e ) {
    if ( e.code === 'KeyC' ) cambiarCamara();
  } );
}

function loadScene()
{
  // Niebla del color del cielo: oculta el final del llano exterior
  scene.fog = new THREE.Fog( COLOR_CIELO, 500, 1800 );

  // Luz ambiente: naranja desde el cielo y marron rojizo rebotado del suelo
  scene.add( new THREE.HemisphereLight( 0xf0b88a, 0x7a4630, 0.6 ) );

  sol = new THREE.DirectionalLight( 0xffddb8, 1.0 );
  sol.castShadow = true;
  sol.shadow.mapSize.set( 2048, 2048 );
  sol.shadow.camera.left   = -SOMBRA_SEMILADO;
  sol.shadow.camera.right  =  SOMBRA_SEMILADO;
  sol.shadow.camera.top    =  SOMBRA_SEMILADO;
  sol.shadow.camera.bottom = -SOMBRA_SEMILADO;
  sol.shadow.camera.near = 1;
  sol.shadow.camera.far  = 600;
  sol.shadow.bias = -0.0005;
  scene.add( sol );
  scene.add( sol.target );

  cargarTerreno();
  crearExterior();
}

// Lee el heightmap (Uint16, fila a fila con el norte arriba) y con el sube
// los vertices de un plano de 512x512
function cargarTerreno()
{
  fetch( 'mapa/victoria_height.bin' )
    .then( function( resp ) { return resp.arrayBuffer(); } )
    .then( function( buffer ) {
      alturas = new Uint16Array( buffer );

      var geo = new THREE.PlaneGeometry( LADO, LADO, TAM_MAPA - 1, TAM_MAPA - 1 );
      geo.rotateX( -Math.PI / 2 );
      var pos = geo.attributes.position;
      for ( var i = 0; i < pos.count; i++ )
        pos.setY( i, alturas[i] / 65535 * DESNIVEL );
      geo.computeVertexNormals();

      var textura = new THREE.TextureLoader().load( 'mapa/victoria_color.jpg' );
      textura.encoding = THREE.sRGBEncoding;
      textura.anisotropy = renderer.capabilities.getMaxAnisotropy();

      terreno = new THREE.Mesh( geo, new THREE.MeshLambertMaterial( { map: textura } ) );
      terreno.receiveShadow = true;
      scene.add( terreno );

      // Lo demas necesita el terreno para apoyarse
      base = crearBase();
      scene.add( base );
      objectsToCheck.push( base );
      objetosSuelo.push( base );
      rocas = crearRocas( base );
      scene.add( rocas );

      // Rover junto a la zona de muestras, mirando hacia el crater
      rover = crearRover();
      var inicio = base.localToWorld( new THREE.Vector3( 10, 0, 26 ) );
      rover.position.set( inicio.x, getAltura( inicio.x, inicio.z ), inicio.z );
      rover.userData.rumbo = rover.rotation.y = base.rotation.y;
      scene.add( rover );
      objetivoSombra = rover.position;

      // Camara en primera persona: hija del cabezal del mastil. Se gira porque
      // una camara mira hacia -Z y el rover avanza hacia +Z
      camaraPrimera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.05, 5000 );
      camaraPrimera.position.set( 0, 0.08, 0.2 );
      camaraPrimera.rotation.y = Math.PI;
      rover.userData.cabezal.add( camaraPrimera );
      crearDeteccion( base );
      muestras = crearMuestras( base );
      scene.add( muestras );
      actualizarMarcador();

      colocarCamaraTercera( 1 );
      actualizarMinimapa();
    } );
}

// Llano exterior: un plano enorme con un agujero donde va el mapa
function crearExterior()
{
  var G = 10000, h = LADO / 2 - 1;
  var forma = new THREE.Shape();
  forma.moveTo( -G, -G ); forma.lineTo( G, -G ); forma.lineTo( G, G ); forma.lineTo( -G, G );
  var agujero = new THREE.Path();
  agujero.moveTo( -h, -h ); agujero.lineTo( -h, h ); agujero.lineTo( h, h ); agujero.lineTo( h, -h );
  forma.holes.push( agujero );

  var geo = new THREE.ShapeGeometry( forma );
  geo.rotateX( -Math.PI / 2 );
  var color = new THREE.Color( COLOR_BORDE ).convertSRGBToLinear();
  exterior = new THREE.Mesh( geo, new THREE.MeshLambertMaterial( { color: color } ) );
  exterior.position.y = ALTURA_BORDE - 0.05;
  exterior.receiveShadow = true;
  scene.add( exterior );
}

// Altura del terreno en el punto (x, z), con interpolacion bilineal
function getAltura( x, z )
{
  if ( !alturas ) return 0;
  var c = ( x / LADO + 0.5 ) * ( TAM_MAPA - 1 );
  var f = ( z / LADO + 0.5 ) * ( TAM_MAPA - 1 );
  if ( c < 0 || f < 0 || c > TAM_MAPA - 1 || f > TAM_MAPA - 1 ) return ALTURA_BORDE;
  var c0 = Math.floor( c ), f0 = Math.floor( f );
  var c1 = Math.min( c0 + 1, TAM_MAPA - 1 ), f1 = Math.min( f0 + 1, TAM_MAPA - 1 );
  var tc = c - c0, tf = f - f0;
  var a = alturas[f0 * TAM_MAPA + c0], b = alturas[f0 * TAM_MAPA + c1];
  var d = alturas[f1 * TAM_MAPA + c0], e = alturas[f1 * TAM_MAPA + c1];
  var v = ( a * ( 1 - tc ) + b * tc ) * ( 1 - tf ) + ( d * ( 1 - tc ) + e * tc ) * tf;
  return v / 65535 * DESNIVEL;
}

function limitarAlMapa( p )
{
  p.x = THREE.MathUtils.clamp( p.x, -LIMITE, LIMITE );
  p.z = THREE.MathUtils.clamp( p.z, -LIMITE, LIMITE );
}

// El sol se mueve con el objetivo para que haya sombras nitidas donde se juega
function actualizarSol()
{
  sol.target.position.copy( objetivoSombra );
  sol.position.copy( objetivoSombra ).addScaledVector( SOL_DIR, 300 );
}

// Camara en tercera persona: detras y encima del rover segun su rumbo.
// k = cuanto se acerca a esa posicion en este fotograma (1 = de golpe)
function colocarCamaraTercera( k )
{
  var r = rover.userData.rumbo, p = rover.position;
  var deseada = new THREE.Vector3(
    p.x - Math.sin( r ) * camTercera.distancia,
    p.y + camTercera.altura,
    p.z - Math.cos( r ) * camTercera.distancia );
  // que no se meta en el suelo
  deseada.y = Math.max( deseada.y, alturaSuelo( deseada.x, deseada.y, deseada.z ) + 0.5 );
  camera.position.lerp( deseada, k );

  var objetivo = new THREE.Vector3( p.x + Math.sin( r ) * 2, p.y + 0.8, p.z + Math.cos( r ) * 2 );
  camera.lookAt( objetivo );
}

function cambiarCamara()
{
  if ( !rover ) return;
  modoCamara = ( modoCamara === 'tercera' ) ? 'primera' : 'tercera';
  mostrarDeteccion( modoCamara === 'primera' );
  if ( modoCamara === 'tercera' ) colocarCamaraTercera( 1 );
}

function actualizarCamara( dt )
{
  // la camara en primera persona es hija del mastil: se mueve sola con el rover
  if ( modoCamara === 'tercera' ) colocarCamaraTercera( 1 - Math.exp( -camTercera.suavizado * dt ) );
}

// Lado del minimapa en pixeles
function ladoMini()
{
  return Math.round( Math.min( window.innerWidth, window.innerHeight ) * 0.28 );
}

// El marco es un div con borde colocado encima del viewport del minimapa
function colocarMarcoMini()
{
  var marco = document.getElementById( 'marcoMini' );
  marco.style.width = marco.style.height = ladoMini() + 'px';
  marco.style.bottom = marco.style.left = MINI_MARGEN + 'px';
}

function actualizarMinimapa()
{
  // el mapa gira con el rover: su direccion de avance queda arriba
  var p = rover.position, r = rover.userData.rumbo;
  camaraMini.position.set( p.x, p.y + MINI_ALTURA, p.z );
  camaraMini.up.set( Math.sin( r ), 0, Math.cos( r ) );
  camaraMini.lookAt( p.x, p.y, p.z );
  marcadorRover.position.set( p.x, p.y + 30, p.z );
  marcadorRover.rotation.y = r;
}

function updateAspectRatio()
{
  renderer.setSize( window.innerWidth, window.innerHeight );
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if ( camaraPrimera ) {
    camaraPrimera.aspect = camera.aspect;
    camaraPrimera.updateProjectionMatrix();
  }
  colocarMarcoMini();
  redimensionarDeteccion();
}

function update()
{
  var dt = Math.min( reloj.getDelta(), 0.1 );       // evita saltos si la pestana estuvo parada

  // el terreno se carga de forma asincrona: hasta entonces no hay nada que mover
  if ( !rover ) return;
  // en pausa en las pantallas de inicio y final y mientras se lee una tarjeta
  if ( estadoJuego !== 'jugando' || tarjetaAbierta ) return;

  actualizarBateria( rover, dt );
  actualizarRover( rover, dt );
  actualizarCamara( dt );
  actualizarMinimapa();
  actualizarMuestras( muestras, rover, base );
  actualizarSol();
  animarBase( base, dt );
  TWEEN.update();
}

function render()
{
  requestAnimationFrame( render );
  update();

  // Vista principal a pantalla completa
  var w = window.innerWidth, h = window.innerHeight;
  renderer.setScissorTest( false );
  renderer.setViewport( 0, 0, w, h );
  renderer.clear();
  var primera = ( modoCamara === 'primera' && camaraPrimera );
  renderer.render( scene, primera ? camaraPrimera : camera );
  if ( primera ) dibujarDeteccion( camaraPrimera );

  // Minimapa abajo a la izquierda. Sus marcas solo se hacen visibles para esta vista
  if ( rover ) {
    var s = ladoMini(), x = MINI_MARGEN, y = MINI_MARGEN;
    renderer.setScissorTest( true );
    renderer.setScissor( x, y, s, s );
    renderer.setViewport( x, y, s, s );
    renderer.clear();
    verMarcasMini( true );
    renderer.render( scene, camaraMini );
    verMarcasMini( false );
  }
}

function verMarcasMini( visibles )
{
  for ( var i = 0; i < marcasMini.length; i++ )
    marcasMini[i].visible = visibles;
}
