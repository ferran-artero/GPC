// Muestras: 3 tipos basados en lo que encontro Opportunity en Meridiani Planum.
// Se colocan al azar en cada partida, cada tipo en su zona.
//
// muestras (Group)
//  |- muestra (Group) x N         userData: { tipo, pieza, recogida }
//      |- pieza (Group)           el objeto, apoyado en el suelo
//      |- marcador                punto de color que solo se ve en el minimapa

// zona: intervalo de altura del terreno donde puede aparecer (0 = fondo del crater, ~66 = llanura)
// apoyo: altura del centro de la pieza para que descanse sobre el suelo
var TIPOS_MUESTRA = [
  { nombre: 'hematites', color: 0x6fa8ff, puntos: 10, cantidad: 6, zona: [ 62, 100 ], apoyo: 0.09 },   // llanura
  { nombre: 'sulfat',    color: 0xffe08a, puntos: 25, cantidad: 4, zona: [ 20, 56 ],  apoyo: 0.14 },   // paredes del crater
  { nombre: 'meteorit',  color: 0xff7a5c, puntos: 50, cantidad: 2, zona: [ 0, 20 ],   apoyo: 0.14 }    // fondo del crater
];
var DIST_BASE_MUESTRAS = 80;      // ninguna mas cerca de la base (m)
var DIST_ENTRE_MUESTRAS = 60;     // separacion minima entre muestras (m)

// Pieza de cada tipo (unos 40 cm)
function crearPieza( tipo )
{
  var pieza = new THREE.Group(), i;
  if ( tipo.nombre === 'hematites' ) {
    // "blueberries": racimo de esferulas gris azulado
    var matH = new THREE.MeshPhongMaterial( { color: 0x4a5a78, emissive: 0x1a2a4a, shininess: 60 } );
    var geoH = new THREE.SphereGeometry( 0.09, 12, 8 );
    var sitios = [ [ 0, 0, 0 ], [ 0.15, 0.02, 0.03 ], [ -0.13, 0.03, 0.08 ], [ 0.03, 0.02, -0.15 ], [ 0.02, 0.14, 0.02 ], [ -0.08, 0.1, -0.09 ] ];
    for ( i = 0; i < sitios.length; i++ ) {
      var bola = new THREE.Mesh( geoH, matH );
      bola.position.fromArray( sitios[i] );
      pieza.add( bola );
    }
  } else if ( tipo.nombre === 'sulfat' ) {
    // roca sedimentaria clara: tres capas apiladas algo giradas
    var matS = new THREE.MeshLambertMaterial( { color: 0xe8dcb0, emissive: 0x4a4020 } );
    for ( i = 0; i < 3; i++ ) {
      var capa = new THREE.Mesh( new THREE.BoxGeometry( 0.36 - i * 0.06, 0.09, 0.28 - i * 0.04 ), matS );
      capa.position.y = -0.1 + i * 0.1;
      capa.rotation.y = i * 0.35;
      pieza.add( capa );
    }
  } else {
    // meteorito de hierro: bloque oscuro y brillante
    var meteorito = new THREE.Mesh( new THREE.DodecahedronGeometry( 0.2 ),
      new THREE.MeshPhongMaterial( { color: 0x3a3634, emissive: 0x2a1410, shininess: 120, specular: 0xaaaaaa } ) );
    meteorito.scale.set( 1.2, 0.8, 1 );
    pieza.add( meteorito );
  }
  return pieza;
}

// Posicion al azar valida para un tipo, o null si no la encuentra
function buscarSitioMuestra( tipo, base, ocupados )
{
  for ( var intento = 0; intento < 3000; intento++ ) {
    var x = ( Math.random() * 2 - 1 ) * ( LIMITE - 20 ), z = ( Math.random() * 2 - 1 ) * ( LIMITE - 20 );
    var h = getAltura( x, z );
    if ( h < tipo.zona[0] || h > tipo.zona[1] ) continue;
    if ( Math.hypot( x - base.position.x, z - base.position.z ) < DIST_BASE_MUESTRAS ) continue;
    var libre = ocupados.every( function( o ) { return Math.hypot( x - o.x, z - o.z ) >= DIST_ENTRE_MUESTRAS; } )
             && rocas.children.every( function( r ) { return Math.hypot( x - r.position.x, z - r.position.z ) >= r.scale.x + 1.5; } );
    if ( libre ) return new THREE.Vector3( x, h, z );
  }
  return null;
}

function crearMuestras( base )
{
  var muestras = new THREE.Group();
  muestras.name = 'muestras';
  var ocupados = [];

  var geoMarcador = new THREE.CircleGeometry( 3, 16 );
  geoMarcador.rotateX( -Math.PI / 2 );

  TIPOS_MUESTRA.forEach( function( tipo ) {
    var matMarcador = new THREE.MeshBasicMaterial( { color: tipo.color, fog: false, depthTest: false } );

    for ( var i = 0; i < tipo.cantidad; i++ ) {
      var sitio = buscarSitioMuestra( tipo, base, ocupados );
      if ( !sitio ) continue;
      ocupados.push( sitio );

      var muestra = new THREE.Group();
      muestra.position.copy( sitio );
      var pieza = crearPieza( tipo );
      pieza.position.y = tipo.apoyo;
      pieza.rotation.y = Math.random() * Math.PI * 2;
      pieza.traverse( function( o ) { if ( o.isMesh ) o.castShadow = o.receiveShadow = true; } );
      var marcador = new THREE.Mesh( geoMarcador, matMarcador );
      marcador.position.y = 25;
      marcador.visible = false;
      marcasMini.push( marcador );
      marcador.renderOrder = 8;
      muestra.add( pieza, marcador );
      muestra.userData = { tipo: tipo, pieza: pieza, recogida: false };
      muestras.add( muestra );

      muestras.updateWorldMatrix( true, true );
      registrarObjetivo( pieza, tipo.nombre, '#' + new THREE.Color( tipo.color ).getHexString() );
    }
  } );
  return muestras;
}

// ---------- Recogida y entrega ----------
// Con E se recoge la muestra que este cerca y, sobre la zona de muestras de la base,
// se entregan todas las que lleva el rover y se suman sus puntos.
var DIST_RECOGER = 4;             // metros
var CAPACIDAD = 3;                // muestras que caben en el rover
var cargadas = 0;
var puntosCarga = 0;              // puntos de las muestras que lleva
var muestraCerca = null;
var sobreZonaEntrega = false;
var puntos = 0, entregadas = 0;

window.addEventListener( 'keydown', function( e ) {
  if ( e.repeat || estadoJuego !== 'jugando' ) return;
  if ( tarjetaAbierta ) {
    if ( e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter' ) cerrarTarjeta();
  } else if ( e.code === 'KeyE' ) {
    accionMuestra();
  }
} );

// Mira que accion hay disponible y actualiza el mensaje en pantalla
function actualizarMuestras( muestras, rover, base )
{
  muestraCerca = null;
  var mejor = DIST_RECOGER;
  muestras.children.forEach( function( m ) {
    if ( m.userData.recogida ) return;
    var dist = m.position.distanceTo( rover.position );
    if ( dist < mejor ) { mejor = dist; muestraCerca = m; }
  } );

  // posado dentro del cuadrado de la losa (en coordenadas locales de la base)
  var pad = base.userData.pad;
  var enBase = base.worldToLocal( rover.position.clone() );
  sobreZonaEntrega = Math.abs( enBase.x - pad.position.x ) < 6 && Math.abs( enBase.z - pad.position.z ) < 6
                  && !rover.userData.enAire && enBase.y > pad.position.y;

  var texto = '';
  if ( brazoOcupado ) texto = '';
  else if ( cargadas > 0 && sobreZonaEntrega ) texto = 'Prem <b>E</b> per a entregar <b>' + cargadas + ( cargadas === 1 ? ' mostra' : ' mostres' ) + '</b>';
  else if ( muestraCerca && cargadas < CAPACIDAD ) texto = 'Prem <b>E</b> per a arreplegar <b>' + muestraCerca.userData.tipo.nombre + '</b>';
  else if ( muestraCerca ) texto = 'Càrrega plena: entrega les mostres a la base';
  if ( texto !== textoMensaje ) {
    textoMensaje = texto;
    var mensaje = document.getElementById( 'mensaje' );
    mensaje.innerHTML = texto;
    mensaje.style.display = texto ? 'block' : 'none';
  }
}

function accionMuestra()
{
  if ( brazoOcupado ) return;
  if ( cargadas > 0 && sobreZonaEntrega ) {
    animarBrazo( function() {
      puntos += puntosCarga;
      entregadas += cargadas;
      recargarBateria( RECARGA_ENTREGA * cargadas );
      cargadas = 0;
      puntosCarga = 0;
      actualizarMarcador();
    }, function() {
      if ( entregadas === muestras.children.length ) finPartida( true );
    } );
  } else if ( muestraCerca && cargadas < CAPACIDAD ) {
    var m = muestraCerca;
    animarBrazo( function() {
      cargadas++;
      puntosCarga += m.userData.tipo.puntos;
      m.userData.recogida = true;
      m.visible = false;
      m.userData.pieza.visible = false;                 // para que el detector deje de marcarla
      actualizarMarcador();
    }, mostrarTarjeta );
  }
}

// Animacion del brazo con Tween: baja, ejecuta 'alBajar', sube y ejecuta 'alAcabar'
var brazoOcupado = false, textoMensaje = '';
function animarBrazo( alBajar, alAcabar )
{
  var d = rover.userData;
  var reposo = { hombro: d.hombro.rotation.x, codo: d.codo.rotation.x, muneca: d.muneca.rotation.x };
  var giro = { hombro: reposo.hombro, codo: reposo.codo, muneca: reposo.muneca };
  function aplicar() {
    d.hombro.rotation.x = giro.hombro; d.codo.rotation.x = giro.codo; d.muneca.rotation.x = giro.muneca;
  }
  brazoOcupado = true;
  var subir = new TWEEN.Tween( giro ).to( reposo, 450 ).easing( TWEEN.Easing.Quadratic.InOut )
    .onUpdate( aplicar ).onComplete( function() { brazoOcupado = false; if ( alAcabar ) alAcabar(); } );
  new TWEEN.Tween( giro ).to( { hombro: 0.45, codo: 0.35, muneca: 0.5 }, 450 ).easing( TWEEN.Easing.Quadratic.InOut )
    .onUpdate( aplicar ).onComplete( alBajar ).chain( subir ).start();
}

function actualizarMarcador()
{
  document.getElementById( 'marcador' ).textContent =
    'Punts: ' + puntos + '   ·   Entregades: ' + entregadas + '/' + muestras.children.length +
    '   ·   Càrrega: ' + cargadas + '/' + CAPACIDAD + ( cargadas === CAPACIDAD ? ' (plena)' : '' );
}
