// Rocas: se reparten con un generador aleatorio de semilla fija, asi salen
// en el mismo sitio en todas las partidas.
//
// rocas (Group)
//  |- roca (Mesh) x N_ROCAS       chocan con el rover (objectsToCheck)
//  |- guijarro (Mesh) x ...       pequenos, alrededor de las rocas, sin colision

var SEMILLA_ROCAS = 2026;
var N_ROCAS = 400;
var DIST_BASE_SIN_ROCAS = 50; // metros alrededor de la base sin rocas

// Generador pseudoaleatorio con semilla (mulberry32): devuelve numeros en [0, 1)
function crearAleatorio( semilla )
{
  var a = semilla;
  return function() {
    a = ( a + 0x6D2B79F5 ) | 0;
    var t = Math.imul( a ^ ( a >>> 15 ), 1 | a );
    t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
    return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
  };
}

function texturaRoca()
{
  return texturaCanvas( 128, function( g, n ) {
    g.fillStyle = '#7d6253'; g.fillRect( 0, 0, n, n );
    for ( var i = 0; i < 1500; i++ ) {
      var v = 70 + Math.random() * 90 | 0;
      g.fillStyle = 'rgba(' + v + ',' + ( v * 0.78 | 0 ) + ',' + ( v * 0.66 | 0 ) + ',0.5)';
      g.fillRect( Math.random() * n, Math.random() * n, 3, 3 );
    }
  }, 2, 2 );
}

// Roca: icosaedro de radio 1 deformado. El desplazamiento depende de la posicion del
// vertice, asi los vertices repetidos se mueven igual y la malla no se abre
function geometriaRoca( azar )
{
  var geo = new THREE.IcosahedronGeometry( 1, 1 );
  var a = azar() * 10, b = azar() * 10, c = azar() * 10;
  var pos = geo.attributes.position, v = new THREE.Vector3();
  for ( var i = 0; i < pos.count; i++ ) {
    v.fromBufferAttribute( pos, i );
    var f = 1 + 0.22 * Math.sin( v.x * 3.1 + a ) * Math.sin( v.y * 2.7 + b )
              + 0.16 * Math.sin( v.z * 4.3 + c ) * Math.sin( v.x * 1.9 + b );
    pos.setXYZ( i, v.x * f, v.y * f, v.z * f );
  }
  geo.computeVertexNormals();
  return geo;
}

function crearRocas( base )
{
  var azar = crearAleatorio( SEMILLA_ROCAS );
  var rocas = new THREE.Group();
  rocas.name = 'rocas';

  var geos = [];
  for ( var i = 0; i < 6; i++ ) geos.push( geometriaRoca( azar ) );
  var textura = texturaRoca();
  var mats = [ 0xffffff, 0xc9a48e, 0x9a8478 ].map( function( color ) {    // tres tonos de piedra
    return new THREE.MeshLambertMaterial( { map: textura, color: color } );
  } );

  function crearPiedra( x, z, radio, sombra ) {
    var m = new THREE.Mesh( geos[ azar() * geos.length | 0 ], mats[ azar() * mats.length | 0 ] );
    var sx = radio * ( 0.8 + azar() * 0.5 ), sy = radio * ( 0.55 + azar() * 0.35 ), sz = radio * ( 0.8 + azar() * 0.5 );
    m.scale.set( sx, sy, sz );
    m.rotation.y = azar() * Math.PI * 2;
    m.position.set( x, getAltura( x, z ) + sy * 0.35, z );   // medio enterrada
    m.castShadow = sombra; m.receiveShadow = true;
    rocas.add( m );
    return m;
  }

  var puestas = 0;
  while ( puestas < N_ROCAS ) {
    var x = ( azar() * 2 - 1 ) * ( LIMITE - 5 ), z = ( azar() * 2 - 1 ) * ( LIMITE - 5 );
    var radio = 0.45 + 2.6 * Math.pow( azar(), 3 );    // muchas pequenas, pocas grandes
    if ( Math.hypot( x - base.position.x, z - base.position.z ) < DIST_BASE_SIN_ROCAS ) continue;
    var roca = crearPiedra( x, z, radio, true );
    objectsToCheck.push( roca );
    puestas++;

    var nGuijarros = azar() * 3 | 0;
    for ( var k = 0; k < nGuijarros; k++ ) {
      var ang = azar() * Math.PI * 2, dist = radio * ( 1.6 + azar() * 2 );
      crearPiedra( x + Math.cos( ang ) * dist, z + Math.sin( ang ) * dist, 0.1 + azar() * 0.18, false );
    }
  }
  return rocas;
}
