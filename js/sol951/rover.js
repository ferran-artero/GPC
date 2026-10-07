// Rover inspirado en Opportunity (MER): grafo de escena jerarquico
// Medidas reales aproximadas: 1.6 m de largo, 2.3 m de ancho con alas, 1.5 m hasta la camara
// Delante = +Z local, izquierda = +X local
//
// rover (Group)                    posicion y rumbo en el mapa
//  |- chasis (Group)
//      |- caja                      caja de electronica (WEB), dorada
//      |- cubierta (Group)          paneles solares: central + 2 alas + trasero
//      |- mastil (Group, gira Y)    poste -> cabezal (gira X) -> 2 camaras (Pancam)
//      |- antenaAG (Group)          antena de alta ganancia (plato)
//      |- antenaBG                  antena de baja ganancia (varilla)
//      |- propulsores (Group)       4 x (carcasa + tobera + llama) bajo las alas + luz
//      |- hombro (Group, gira X)    brazo -> codo (gira X) -> antebrazo -> muneca -> pinza
//      |- balancinI / balancinD     suspension rocker-bogie de cada lado
//          |- direccion (gira Y)    rueda delantera
//          |- bogie (Group)
//              |- rueda central
//              |- direccion (gira Y) rueda trasera

var RUEDA_R = 0.13, RUEDA_ANCHO = 0.16;

// Conduccion (m/s, m/s^2, rad/s)
var VEL_MAX = 14, VEL_ATRAS = 3, ACEL = 4, FRENO = 8, GIRO = 1.0;
var DIR_MAX = 0.45;           // angulo maximo de las ruedas directrices

// Vuelo con propulsores (tecla Espacio)
var ALTURA_VUELO = 12;        // altura maxima sobre el suelo (m)
var VEL_SUBIDA = 8, VEL_BAJADA = 3;   // limites de la velocidad vertical al mantener el vuelo (m/s)
var EMPUJE = 10;              // aceleracion vertical que dan los propulsores (m/s^2)
var GRAVEDAD = 3.71;          // Marte
var PEGADO_SUELO = 0.3;       // al rodar cuesta abajo, huecos menores que esto no cuentan como salto

// Teclado
var controls = { adelante: false, atras: false, izquierda: false, derecha: false, volar: false };

function cambiarTecla( code, pulsada )
{
  if ( code === 'KeyW' || code === 'ArrowUp' )    controls.adelante  = pulsada;
  if ( code === 'KeyS' || code === 'ArrowDown' )  controls.atras     = pulsada;
  if ( code === 'KeyA' || code === 'ArrowLeft' )  controls.izquierda = pulsada;
  if ( code === 'KeyD' || code === 'ArrowRight' ) controls.derecha   = pulsada;
  if ( code === 'Space' )                         controls.volar     = pulsada;
}

document.addEventListener( 'keydown', function( event ) {
  cambiarTecla( event.code, true );
  if ( event.code === 'Space' ) event.preventDefault();   // que no pulse el boton que tenga el foco
} );
document.addEventListener( 'keyup', function( event ) {
  cambiarTecla( event.code, false );
} );

// Banda de rodadura con garras, para que se vea girar la rueda
function texturaRueda()
{
  return texturaCanvas( 128, function( g, n ) {
    g.fillStyle = '#8a7466'; g.fillRect( 0, 0, n, n );
    g.fillStyle = '#4e4038';
    for ( var i = 0; i < 16; i++ ) g.fillRect( i * n / 16, 0, n / 48, n );
  } );
}

// Barra entre los puntos a y b: una caja alargada en Z, centrada y orientada con lookAt
function barra( a, b, grosor, mat )
{
  var m = new THREE.Mesh( new THREE.BoxGeometry( grosor, grosor, a.distanceTo( b ) ), mat );
  m.position.copy( a ).add( b ).multiplyScalar( 0.5 );
  m.lookAt( b );
  return m;
}

function crearRover()
{
  var rover = new THREE.Group();
  rover.name = 'rover';
  rover.rotation.order = 'YXZ';                         // rumbo, luego cabeceo y alabeo

  var matOro     = new THREE.MeshPhongMaterial( { color: 0xb0843a, shininess: 50, specular: 0x554422 } );
  var matBlanco  = new THREE.MeshPhongMaterial( { color: 0xe4e2dc, shininess: 30 } );
  var matMetal   = new THREE.MeshPhongMaterial( { color: 0x9aa0a6, shininess: 80, specular: 0x666666 } );
  var matOscuro  = new THREE.MeshLambertMaterial( { color: 0x2c2e33 } );
  var matSolar   = new THREE.MeshLambertMaterial( { map: texturaSolar() } );
  var matLente   = new THREE.MeshPhongMaterial( { color: 0x111111, shininess: 120, specular: 0x8899aa } );
  var matRueda   = new THREE.MeshLambertMaterial( { map: texturaRueda() } );
  var matLlanta  = new THREE.MeshLambertMaterial( { color: 0x6e5a4e } );
  var matBajos   = new THREE.MeshPhongMaterial( { color: 0xc9b8a6, shininess: 15 } );

  var chasis = new THREE.Group();
  rover.add( chasis );

  // Caja de electronica
  var caja = new THREE.Mesh( new THREE.BoxGeometry( 0.8, 0.32, 1.1 ), matOro );
  caja.position.y = 0.56;
  chasis.add( caja );

  // Cubierta solar: panel central, dos alas y trasero
  var cubierta = new THREE.Group();
  cubierta.position.y = 0.74;
  function panel( w, l, x, z ) {
    var p = new THREE.Mesh( new THREE.BoxGeometry( w, 0.03, l ), [ matMetal, matMetal, matSolar, matOscuro, matMetal, matMetal ] );
    p.position.set( x, 0, z );
    cubierta.add( p );
  }
  panel( 1.1, 1.25, 0, -0.05 );                        // central
  panel( 0.6, 0.85, 0.85, -0.15 );                     // ala izquierda
  panel( 0.6, 0.85, -0.85, -0.15 );                    // ala derecha
  panel( 0.8, 0.35, 0, -0.85 );                        // trasero
  chasis.add( cubierta );

  // Mastil (Pancam Mast Assembly): poste -> cabezal -> camaras
  var mastil = new THREE.Group();
  mastil.position.set( -0.3, 0.76, 0.45 );
  var poste = new THREE.Mesh( new THREE.CylinderGeometry( 0.035, 0.045, 0.8, 10 ), matBlanco );
  poste.position.y = 0.4;
  var cabezal = new THREE.Group();
  cabezal.position.y = 0.85;
  var soporte = new THREE.Mesh( new THREE.BoxGeometry( 0.12, 0.1, 0.1 ), matBlanco );
  var barraCam = new THREE.Mesh( new THREE.BoxGeometry( 0.38, 0.08, 0.1 ), matBlanco );
  barraCam.position.y = 0.08;
  cabezal.add( soporte, barraCam );
  [ -0.13, 0.13 ].forEach( function( x ) {             // camaras estereo
    var cam = new THREE.Mesh( new THREE.BoxGeometry( 0.12, 0.11, 0.16 ), matOscuro );
    cam.position.set( x * 1.08, 0.08, 0.02 );
    var lente = new THREE.Mesh( new THREE.CylinderGeometry( 0.025, 0.025, 0.02, 12 ), matLente );
    lente.rotation.x = Math.PI / 2;
    lente.position.set( x * 1.08, 0.08, 0.105 );
    cabezal.add( cam, lente );
  } );
  mastil.add( poste, cabezal );
  chasis.add( mastil );

  // Antena de alta ganancia: poste + plato mirando al cielo
  var antenaAG = new THREE.Group();
  antenaAG.position.set( 0.3, 0.76, -0.35 );
  var posteAG = new THREE.Mesh( new THREE.CylinderGeometry( 0.025, 0.025, 0.25, 8 ), matMetal );
  posteAG.position.y = 0.125;
  var plato = new THREE.Mesh( new THREE.CylinderGeometry( 0.14, 0.14, 0.03, 20 ), matOscuro );
  plato.position.y = 0.27;
  plato.rotation.x = 0.5;
  antenaAG.add( posteAG, plato );
  chasis.add( antenaAG );

  // Antena de baja ganancia
  var antenaBG = new THREE.Mesh( new THREE.CylinderGeometry( 0.012, 0.012, 0.5, 6 ), matMetal );
  antenaBG.position.set( -0.35, 1.01, -0.4 );
  chasis.add( antenaBG );

  // Propulsores bajo las alas
  var propulsores = new THREE.Group();
  var matLlama = new THREE.MeshBasicMaterial( { color: 0xffa040, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false } );
  var geoLlama = new THREE.ConeGeometry( 0.05, 0.5, 12, 1, true );
  geoLlama.rotateX( Math.PI );
  geoLlama.translate( 0, -0.25, 0 );                    // base en el origen: al escalar en Y crece hacia abajo
  var llamas = [];
  [ [ 0.95, 0.2 ], [ 0.95, -0.45 ], [ -0.95, 0.2 ], [ -0.95, -0.45 ] ].forEach( function( c ) {
    var prop = new THREE.Group();
    prop.position.set( c[0], 0.72, c[1] );
    var carcasa = new THREE.Mesh( new THREE.CylinderGeometry( 0.06, 0.06, 0.08, 12 ), matMetal );
    carcasa.position.y = -0.04;
    var tobera = new THREE.Mesh( new THREE.CylinderGeometry( 0.035, 0.06, 0.07, 12, 1, true ), matOscuro );
    tobera.position.y = -0.115;
    var llama = new THREE.Mesh( geoLlama, matLlama );
    llama.position.y = -0.15;
    llama.visible = false;
    prop.add( carcasa, tobera, llama );
    propulsores.add( prop );
    llamas.push( llama );
  } );
  var luzPropulsor = new THREE.PointLight( 0xff8a30, 0, 8, 2 );
  luzPropulsor.position.y = 0.2;
  propulsores.add( luzPropulsor );
  chasis.add( propulsores );

  // Brazo robotico (IDD): hombro -> brazo -> codo -> antebrazo -> muneca -> pinza
  var hombro = new THREE.Group();
  hombro.position.set( 0.2, 0.5, 0.58 );
  hombro.rotation.x = -0.25;
  var anclaje = new THREE.Mesh( new THREE.BoxGeometry( 0.12, 0.12, 0.08 ), matMetal );
  anclaje.position.set( 0.2, 0.5, 0.57 );
  chasis.add( anclaje );
  var brazo = new THREE.Mesh( new THREE.CylinderGeometry( 0.03, 0.03, 0.45, 8 ), matBlanco );
  brazo.rotation.x = Math.PI / 2; brazo.position.z = 0.225;
  var codo = new THREE.Group();
  codo.position.z = 0.45;
  codo.rotation.x = 1.0;
  var articulacion = new THREE.Mesh( new THREE.SphereGeometry( 0.045, 10, 8 ), matMetal );
  var antebrazo = new THREE.Mesh( new THREE.CylinderGeometry( 0.025, 0.025, 0.35, 8 ), matBlanco );
  antebrazo.rotation.x = Math.PI / 2; antebrazo.position.z = 0.175;
  var muneca = new THREE.Group();
  muneca.position.z = 0.35;
  var torreta = new THREE.Mesh( new THREE.BoxGeometry( 0.12, 0.12, 0.08 ), matMetal );
  var pinza = new THREE.Group();                        // 4 instrumentos
  pinza.position.z = 0.04;
  for ( var i = 0; i < 4; i++ ) {
    var herramienta = new THREE.Mesh( new THREE.CylinderGeometry( 0.02, 0.02, 0.1, 8 ), matOscuro );
    var a = i / 4 * Math.PI * 2 + Math.PI / 4;
    herramienta.rotation.x = Math.PI / 2;
    herramienta.position.set( Math.cos( a ) * 0.04, Math.sin( a ) * 0.04, 0.05 );
    pinza.add( herramienta );
  }
  muneca.add( torreta, pinza );
  codo.add( articulacion, antebrazo, muneca );
  hombro.add( brazo, codo );
  chasis.add( hombro );

  // Suspension rocker-bogie: balancin (delantera) -> bogie (central y trasera)
  var ruedas = [], direcciones = [];
  function crearRueda( s ) {                            // s = +1 izquierda, -1 derecha
    var rueda = new THREE.Group();
    var neumatico = new THREE.Mesh( new THREE.CylinderGeometry( RUEDA_R, RUEDA_R, RUEDA_ANCHO, 20 ), [ matRueda, matLlanta, matLlanta ] );
    neumatico.rotation.z = Math.PI / 2;
    var buje = new THREE.Mesh( new THREE.CylinderGeometry( 0.04, 0.04, RUEDA_ANCHO + 0.02, 10 ), matMetal );
    buje.rotation.z = Math.PI / 2;
    rueda.add( neumatico, buje );
    rueda.position.x = s * 0.1;
    ruedas.push( rueda );
    return rueda;
  }
  function crearDireccion( s, delantera ) {
    var dir = new THREE.Group();
    dir.userData.signo = delantera ? 1 : -1;            // las traseras giran al reves
    var eje = new THREE.Mesh( new THREE.CylinderGeometry( 0.02, 0.02, 0.2, 8 ), matMetal );
    eje.position.y = 0.1;
    dir.add( eje, crearRueda( s ) );
    direcciones.push( dir );
    return dir;
  }
  var balancines = [];
  [ 1, -1 ].forEach( function( s ) {
    var x = s * 0.52;
    var P = new THREE.Vector3( x, 0.45, 0.12 );         // pivote del balancin en el chasis
    var F = new THREE.Vector3( x, RUEDA_R, 0.55 );      // rueda delantera
    var B = new THREE.Vector3( x, 0.3, -0.25 );         // pivote del bogie
    var M = new THREE.Vector3( x, RUEDA_R, 0.0 );       // rueda central
    var T = new THREE.Vector3( x, RUEDA_R, -0.5 );      // rueda trasera

    var balancin = new THREE.Group();
    balancin.position.copy( P );
    var arriba = new THREE.Vector3( 0, 0.2, 0 );        // alto del eje de direccion
    balancin.add( barra( new THREE.Vector3(), F.clone().sub( P ).add( arriba ), 0.045, matBajos ) );
    balancin.add( barra( new THREE.Vector3(), B.clone().sub( P ), 0.045, matBajos ) );
    var dirDel = crearDireccion( s, true );
    dirDel.position.copy( F ).sub( P );
    balancin.add( dirDel );

    var bogie = new THREE.Group();
    bogie.position.copy( B ).sub( P );
    bogie.add( barra( new THREE.Vector3(), M.clone().sub( B ), 0.04, matBajos ) );
    bogie.add( barra( new THREE.Vector3(), T.clone().sub( B ).add( arriba ), 0.04, matBajos ) );
    var central = crearRueda( s );
    central.position.add( M.clone().sub( B ) );
    var dirTras = crearDireccion( s, false );
    dirTras.position.copy( T ).sub( B );
    bogie.add( central, dirTras );
    balancin.add( bogie );

    // eje que une el balancin con la caja
    var pivote = new THREE.Mesh( new THREE.CylinderGeometry( 0.05, 0.05, 0.2, 10 ), matMetal );
    pivote.rotation.z = Math.PI / 2;
    pivote.position.x = -s * 0.05;
    balancin.add( pivote );
    chasis.add( balancin );
    balancines.push( balancin );
  } );

  rover.traverse( function( o ) { if ( o.isMesh ) { o.castShadow = true; o.receiveShadow = true; } } );
  llamas.forEach( function( l ) { l.castShadow = l.receiveShadow = false; } );

  rover.userData = {
    chasis: chasis, ruedas: ruedas, direcciones: direcciones, balancines: balancines,
    mastil: mastil, cabezal: cabezal, hombro: hombro, codo: codo, muneca: muneca,
    llamas: llamas, luzPropulsor: luzPropulsor,
    rumbo: 0, velocidad: 0, angDir: 0, vy: 0, enAire: false, empuje: 0
  };
  return rover;
}

// ---------- Conduccion ----------
function acercar( v, objetivo, paso )
{
  return v < objetivo ? Math.min( v + paso, objetivo ) : Math.max( v - paso, objetivo );
}

function actualizarRover( rover, dt )
{
  var d = rover.userData;
  var giro = ( controls.izquierda ? 1 : 0 ) - ( controls.derecha ? 1 : 0 );

  // Velocidad: acelera hacia la deseada; frena mas fuerte al soltar o al invertir
  var deseada = controls.adelante ? VEL_MAX : controls.atras ? -VEL_ATRAS : 0;
  var a = ( deseada === 0 || deseada * d.velocidad < 0 ) ? FRENO : ACEL;
  d.velocidad = acercar( d.velocidad, deseada, a * dt );

  // Rumbo: marcha atras invierte el giro, como un coche
  d.rumbo += giro * GIRO * dt * ( d.velocidad < -0.1 ? -1 : 1 );
  rover.rotation.y = d.rumbo;

  // Colision: se comprueba lo que hay delante y solo se avanza si esta libre
  var paso = d.velocidad * dt;
  var dir = new THREE.Vector3( 0, 0, 1 ).applyEuler( rover.rotation );
  if ( paso < 0 ) dir.negate();
  if ( paso !== 0 && hayObstaculo( rover, dir, Math.abs( paso ) + ROVER_RADIO ) ) {
    d.velocidad = 0;
    paso = 0;
  }
  rover.position.x += Math.sin( d.rumbo ) * paso;
  rover.position.z += Math.cos( d.rumbo ) * paso;
  limitarAlMapa( rover.position );

  // Apoyo en el suelo: altura y orientacion a partir de 4 puntos alrededor
  var L = 0.55, W = 0.62;
  var fx = Math.sin( d.rumbo ), fz = Math.cos( d.rumbo );   // delante
  var lx = fz, lz = -fx;                                      // izquierda
  var p = rover.position;
  function apoyo( x, z ) { return alturaSuelo( x, p.y, z ); }
  var hF = apoyo( p.x + fx * L, p.z + fz * L ), hB = apoyo( p.x - fx * L, p.z - fz * L );
  var hL = apoyo( p.x + lx * W, p.z + lz * W ), hR = apoyo( p.x - lx * W, p.z - lz * W );
  var suelo = Math.max( apoyo( p.x, p.z ), ( hF + hB ) / 2, ( hL + hR ) / 2 );

  // Vuelo: con Espacio sube hasta ALTURA_VUELO sobre el suelo; sin Espacio cae
  var empujando = controls.volar;
  if ( empujando ) {
    var vyDeseada = THREE.MathUtils.clamp( ( ALTURA_VUELO - ( p.y - suelo ) ) * 1.5, -VEL_BAJADA, VEL_SUBIDA );
    d.vy = acercar( d.vy, vyDeseada, EMPUJE * dt );
  } else {
    d.vy -= GRAVEDAD * dt;
  }
  p.y += d.vy * dt;
  if ( p.y <= suelo || ( !d.enAire && !empujando && p.y - suelo < PEGADO_SUELO ) ) {
    p.y = suelo;
    d.vy = Math.max( d.vy, 0 );
    d.enAire = false;
  } else {
    d.enAire = true;
  }

  // Orientacion: en el suelo se adapta a la pendiente; en el aire se nivela poco a poco
  var k = 1 - Math.exp( -8 * dt );
  var cabeceo = d.enAire ? 0 : -Math.atan2( hF - hB, 2 * L );
  var alabeo  = d.enAire ? 0 :  Math.atan2( hL - hR, 2 * W );
  var kGiro = d.enAire ? k * 0.3 : k;
  rover.rotation.x += ( cabeceo - rover.rotation.x ) * kGiro;
  rover.rotation.z += ( alabeo  - rover.rotation.z ) * kGiro;

  // Llamas: crecen con el empuje y parpadean
  d.empuje += ( ( empujando ? 1 : 0 ) - d.empuje ) * ( 1 - Math.exp( -12 * dt ) );
  d.llamas.forEach( function( l ) {
    l.visible = d.empuje > 0.02;
    l.scale.set( 0.8 + 0.4 * d.empuje, d.empuje * ( 0.8 + 0.4 * Math.random() ), 0.8 + 0.4 * d.empuje );
  } );
  d.luzPropulsor.intensity = d.empuje * ( 1.6 + 0.4 * Math.random() );

  // Animaciones: giro de las ruedas segun lo recorrido y angulo de direccion
  var giroRueda = d.velocidad * dt / RUEDA_R;
  d.ruedas.forEach( function( r ) { r.rotation.x += giroRueda; } );
  d.angDir += ( giro * DIR_MAX - d.angDir ) * k;
  d.direcciones.forEach( function( dir ) { dir.rotation.y = d.angDir * dir.userData.signo; } );
}
