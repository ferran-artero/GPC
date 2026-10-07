// Deteccion de objetos simulada para la camara en primera persona (estilo YOLO)
//
// No hay red neuronal: el juego ya sabe donde esta cada objeto. Se proyectan a la
// pantalla las 8 esquinas de su caja envolvente y se dibuja el rectangulo que las
// contiene, con etiqueta y "confianza", en un canvas 2D encima del juego.

var ALCANCE_DETECCION = 450;  // metros: mas lejos no se detecta
var lienzoDet, ctxDet;
var MIN_RECUADRO = 18;        // px
var objetivosDet = [];        // { objeto, esquinas, centro, etiqueta, color }

function crearDeteccion( base )
{
  lienzoDet = document.getElementById( 'deteccion' );
  ctxDet = lienzoDet.getContext( '2d' );
  redimensionarDeteccion();

  registrarObjetivo( base.userData.pad, 'zona de mostres', '#ffd23f' );
}

// Anade un objeto detectable. Como no se mueven, la caja se calcula una sola vez:
// se mide en los ejes locales del objeto y se guardan sus 8 esquinas en el mundo
function registrarObjetivo( objeto, etiqueta, color )
{
  objeto.updateWorldMatrix( true, true );
  var aLocal = new THREE.Matrix4().copy( objeto.matrixWorld ).invert();
  var caja = new THREE.Box3(), m = new THREE.Matrix4(), cajaMalla = new THREE.Box3();
  objeto.traverse( function( hijo ) {
    if ( !hijo.isMesh ) return;
    if ( !hijo.geometry.boundingBox ) hijo.geometry.computeBoundingBox();
    m.multiplyMatrices( aLocal, hijo.matrixWorld );
    caja.union( cajaMalla.copy( hijo.geometry.boundingBox ).applyMatrix4( m ) );
  } );
  var esquinas = [];
  for ( var k = 0; k < 8; k++ )
    esquinas.push( new THREE.Vector3( k & 1 ? caja.max.x : caja.min.x, k & 2 ? caja.max.y : caja.min.y,
      k & 4 ? caja.max.z : caja.min.z ).applyMatrix4( objeto.matrixWorld ) );
  var centro = caja.getCenter( new THREE.Vector3() ).applyMatrix4( objeto.matrixWorld );
  objetivosDet.push( { objeto: objeto, esquinas: esquinas, centro: centro, etiqueta: etiqueta, color: color } );
}

function redimensionarDeteccion()
{
  if ( !lienzoDet ) return;
  lienzoDet.width = window.innerWidth;
  lienzoDet.height = window.innerHeight;
}

function mostrarDeteccion( visible )
{
  if ( lienzoDet ) lienzoDet.style.display = visible ? 'block' : 'none';
}

// true si el terreno tapa la linea entre a y b (se muestrea el heightmap)
function tapadoPorTerreno( a, b )
{
  for ( var i = 1; i < 24; i++ ) {
    var t = i / 24;
    var x = a.x + ( b.x - a.x ) * t, z = a.z + ( b.z - a.z ) * t;
    if ( getAltura( x, z ) > a.y + ( b.y - a.y ) * t + 1.2 ) return true;
  }
  return false;
}

function dibujarDeteccion( camara )
{
  var g = ctxDet, w = lienzoDet.width, h = lienzoDet.height;
  var tiempo = performance.now() / 1000;
  g.clearRect( 0, 0, w, h );

  var posCam = camara.getWorldPosition( new THREE.Vector3() );
  var v = new THREE.Vector3(), nDetectados = 0;

  objetivosDet.forEach( function( o, i ) {
    if ( !o.objeto.visible ) return;
    var dist = posCam.distanceTo( o.centro );
    if ( dist > ALCANCE_DETECCION || tapadoPorTerreno( posCam, o.centro ) ) return;

    // Proyectar las 8 esquinas de la caja; las que quedan detras de la camara no cuentan
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, delante = 0;
    for ( var k = 0; k < 8; k++ ) {
      v.copy( o.esquinas[k] ).applyMatrix4( camara.matrixWorldInverse );
      if ( v.z > -camara.near ) continue;
      delante++;
      v.applyMatrix4( camara.projectionMatrix );        // coordenadas normalizadas (-1..1)
      var px = ( v.x + 1 ) / 2 * w, py = ( 1 - v.y ) / 2 * h;
      x0 = Math.min( x0, px ); x1 = Math.max( x1, px );
      y0 = Math.min( y0, py ); y1 = Math.max( y1, py );
    }
    if ( delante < 4 ) return;
    if ( x1 < 0 || x0 > w || y1 < 0 || y0 > h ) return; // fuera de pantalla
    if ( x1 - x0 < MIN_RECUADRO ) { x0 = ( x0 + x1 - MIN_RECUADRO ) / 2; x1 = x0 + MIN_RECUADRO; }
    if ( y1 - y0 < MIN_RECUADRO ) { y0 = ( y0 + y1 - MIN_RECUADRO ) / 2; y1 = y0 + MIN_RECUADRO; }
    x0 = Math.max( x0, 2 ); y0 = Math.max( y0, 2 ); x1 = Math.min( x1, w - 2 ); y1 = Math.min( y1, h - 2 );

    // La confianza baja con la distancia y oscila un poco
    var conf = 0.97 - 0.45 * dist / ALCANCE_DETECCION + 0.02 * Math.sin( tiempo * 3 + i * 1.7 );
    var texto = o.etiqueta + ' ' + conf.toFixed( 2 ) + '  ' + dist.toFixed( 0 ) + ' m';

    g.strokeStyle = o.color; g.lineWidth = 2;
    g.strokeRect( x0, y0, x1 - x0, y1 - y0 );
    g.font = 'bold 13px monospace';
    var anchoTexto = g.measureText( texto ).width + 8;
    var yEtiqueta = y0 > 20 ? y0 - 18 : y0;
    g.fillStyle = o.color; g.fillRect( x0 - 1, yEtiqueta, anchoTexto, 18 );
    g.fillStyle = '#101010'; g.fillText( texto, x0 + 3, yEtiqueta + 13 );
    nDetectados++;
  } );

  // Marco de camara: esquinas, reticula y texto de estado
  g.strokeStyle = 'rgba(243,230,216,0.8)'; g.lineWidth = 2;
  var m = 24, l = 40;
  [ [ m, m, 1, 1 ], [ w - m, m, -1, 1 ], [ m, h - m, 1, -1 ], [ w - m, h - m, -1, -1 ] ].forEach( function( c ) {
    g.beginPath(); g.moveTo( c[0] + l * c[2], c[1] ); g.lineTo( c[0], c[1] ); g.lineTo( c[0], c[1] + l * c[3] ); g.stroke();
  } );
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo( w / 2 - 14, h / 2 ); g.lineTo( w / 2 + 14, h / 2 );
  g.moveTo( w / 2, h / 2 - 14 ); g.lineTo( w / 2, h / 2 + 14 );
  g.stroke();
  g.fillStyle = 'rgba(243,230,216,0.9)'; g.font = '13px monospace';
  g.fillText( "CÀM MÀSTIL  ·  DETECCIÓ D'OBJECTES  ·  " + nDetectados + ' detectats', m + 12, m + 20 );
  var s = ladoMini();                                    // no pintar encima del minimapa
  g.clearRect( 0, h - s - 2 * MINI_MARGEN, s + 2 * MINI_MARGEN, s + 2 * MINI_MARGEN );
  if ( Math.floor( tiempo * 2 ) % 2 === 0 ) {            // punto rojo de grabacion
    g.fillStyle = '#ff3b30'; g.beginPath(); g.arc( w - m - 18, m + 16, 5, 0, Math.PI * 2 ); g.fill();
  }
}
