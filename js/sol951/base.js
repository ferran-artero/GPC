// Base marciana: grafo de escena, texturas procedurales y animacion
//
// base (Group, orientada hacia el crater)
//  |- plataforma            losa hexagonal de hormigon
//  |- habitat (Group)       pared cilindrica + cupula + puerta
//  |- laboratorio (Group)   modulo cilindrico tumbado (entra en el habitat) + tapa + ventanas
//  |- antena (Group)        mastil -> cabezal (gira) -> brazo, plato, receptor
//  |- paneles (Group)       4 paneles solares sobre postes
//  |- pad (Group)           zona de entrega de muestras + 4 balizas intermitentes

var BASE_X = -330, BASE_Z = 300;     // llano al suroeste del crater

// ---------- Texturas procedurales (canvas) ----------
function texturaCanvas( tam, dibujar, repX, repY )
{
  var c = document.createElement( 'canvas' );
  c.width = c.height = tam;
  dibujar( c.getContext( '2d' ), tam );
  var t = new THREE.CanvasTexture( c );
  t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set( repX || 1, repY || 1 );
  t.anisotropy = 8;
  return t;
}

function texturaHormigon()
{
  return texturaCanvas( 256, function( g, n ) {
    g.fillStyle = '#8f8a84'; g.fillRect( 0, 0, n, n );
    for ( var i = 0; i < 4000; i++ ) {                   // grano
      var v = 110 + Math.random() * 60 | 0;
      g.fillStyle = 'rgba(' + v + ',' + ( v - 4 ) + ',' + ( v - 8 ) + ',0.35)';
      g.fillRect( Math.random() * n, Math.random() * n, 2, 2 );
    }
    for ( var j = 0; j < 60; j++ ) {                     // manchas de polvo marciano
      g.fillStyle = 'rgba(150,95,65,' + ( 0.04 + Math.random() * 0.08 ) + ')';
      g.beginPath(); g.arc( Math.random() * n, Math.random() * n, 8 + Math.random() * 30, 0, Math.PI * 2 ); g.fill();
    }
    g.strokeStyle = 'rgba(40,40,40,0.6)'; g.lineWidth = 2;   // juntas entre losas
    g.strokeRect( 0, 0, n, n );
  }, 6, 6 );
}

// polvo = true: para paredes verticales, con polvo acumulado en la parte baja
function texturaModulo( polvo )
{
  var filas = polvo ? 8 : 4;
  return texturaCanvas( 256, function( g, n ) {
    g.fillStyle = '#e9e6df'; g.fillRect( 0, 0, n, n );
    g.strokeStyle = '#b9b4ab'; g.lineWidth = 3;
    for ( var i = 0; i <= filas; i++ ) {                 // paneles del casco
      g.beginPath(); g.moveTo( 0, i * n / filas ); g.lineTo( n, i * n / filas ); g.stroke();
    }
    for ( i = 0; i <= 4; i++ ) {
      g.beginPath(); g.moveTo( i * n / 4, 0 ); g.lineTo( i * n / 4, n ); g.stroke();
    }
    g.fillStyle = '#c9c4ba';                             // remaches
    for ( var x = 0; x < 4; x++ ) for ( var y = 0; y < filas; y++ )
      g.fillRect( x * n / 4 + 6, y * n / filas + 6, 5, 5 );
    if ( polvo ) {
      var grad = g.createLinearGradient( 0, n * 0.45, 0, n );
      grad.addColorStop( 0, 'rgba(150,95,65,0)' ); grad.addColorStop( 1, 'rgba(150,95,65,0.6)' );
      g.fillStyle = grad; g.fillRect( 0, 0, n, n );
    }
  }, 4, polvo ? 1 : 2 );
}

function texturaSolar()
{
  return texturaCanvas( 256, function( g, n ) {
    g.fillStyle = '#c8ccd2'; g.fillRect( 0, 0, n, n );  // marco
    var celdas = 8, m = 4, lado = ( n - m ) / celdas;
    for ( var i = 0; i < celdas; i++ ) for ( var j = 0; j < celdas; j++ ) {
      var grad = g.createLinearGradient( 0, j * lado, 0, ( j + 1 ) * lado );
      grad.addColorStop( 0, '#1d3a78' ); grad.addColorStop( 1, '#10224a' );
      g.fillStyle = grad;
      g.fillRect( m + i * lado, m + j * lado, lado - m, lado - m );
    }
    g.fillStyle = 'rgba(150,95,65,0.14)'; g.fillRect( 0, 0, n, n );   // capa fina de polvo
  } );
}

function texturaPeligro()
{
  return texturaCanvas( 512, function( g, n ) {
    g.fillStyle = '#5f5b56'; g.fillRect( 0, 0, n, n );
    var b = n * 0.12;                                     // banda amarilla/negra en el borde
    g.save();
    g.beginPath(); g.rect( 0, 0, n, n ); g.rect( b, b, n - 2 * b, n - 2 * b ); g.clip( 'evenodd' );
    g.fillStyle = '#f2b705'; g.fillRect( 0, 0, n, n );
    g.fillStyle = '#1a1a1a';
    for ( var k = -n; k < 2 * n; k += 48 ) {
      g.beginPath(); g.moveTo( k, 0 ); g.lineTo( k + 24, 0 ); g.lineTo( k + 24 - n, n ); g.lineTo( k - n, n ); g.fill();
    }
    g.restore();
    g.fillStyle = '#f2b705'; g.font = 'bold ' + ( n * 0.11 | 0 ) + 'px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText( 'MOSTRES', n / 2, n / 2 );
  } );
}

// ---------- Construccion ----------
function crearBase()
{
  var base = new THREE.Group();
  base.name = 'base';
  var suelo = getAltura( BASE_X, BASE_Z );
  base.position.set( BASE_X, suelo, BASE_Z );
  base.rotation.y = Math.atan2( -BASE_X, -BASE_Z );    // el eje +Z local mira hacia el crater
  base.updateMatrixWorld();

  // altura del terreno bajo un punto local de la base
  function sueloLocal( lx, lz ) {
    var w = base.localToWorld( new THREE.Vector3( lx, 0, lz ) );
    return getAltura( w.x, w.z ) - suelo;
  }

  var matHormigon = new THREE.MeshLambertMaterial( { map: texturaHormigon() } );
  var matModulo   = new THREE.MeshPhongMaterial( { map: texturaModulo(), shininess: 40, specular: 0x333333 } );
  var matMetal    = new THREE.MeshPhongMaterial( { color: 0x9aa0a6, shininess: 80, specular: 0x666666 } );
  var matOscuro   = new THREE.MeshLambertMaterial( { color: 0x3a3d42 } );
  var matVentana  = new THREE.MeshPhongMaterial( { color: 0x113355, emissive: 0x2a6fb0, emissiveIntensity: 0.6, shininess: 100 } );
  var matNaranja  = new THREE.MeshLambertMaterial( { color: 0xd8601c } );

  // Plataforma: losa gruesa medio enterrada
  var plataforma = new THREE.Mesh( new THREE.CylinderGeometry( 16, 16.5, 2, 6 ), matHormigon );
  plataforma.position.y = 0.2;
  base.add( plataforma );
  var TOP = 1.2;                                       // cota superior de la losa

  // Habitat: pared + cupula + puerta
  var habitat = new THREE.Group();
  habitat.position.set( -4, TOP, -3 );
  var matPared = new THREE.MeshPhongMaterial( { map: texturaModulo( true ), shininess: 40, specular: 0x333333 } );
  var pared = new THREE.Mesh( new THREE.CylinderGeometry( 6, 6, 2.5, 32 ), matPared );
  pared.position.y = 1.25;
  var cupula = new THREE.Mesh( new THREE.SphereGeometry( 6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2 ), matModulo );
  cupula.position.y = 2.5;
  var puerta = new THREE.Mesh( new THREE.BoxGeometry( 1.6, 2.2, 1 ), matOscuro );
  puerta.position.set( 0, 1.1, 5.8 );
  var marco = new THREE.Mesh( new THREE.BoxGeometry( 2.2, 2.6, 0.9 ), matNaranja );
  marco.position.set( 0, 1.3, 5.7 );
  habitat.add( pared, cupula, marco, puerta );
  for ( var i = 0; i < 6; i++ ) {                      // ojos de buey en la cupula
    var v = new THREE.Mesh( new THREE.CircleGeometry( 0.6, 16 ), matVentana );
    var a = i / 6 * Math.PI * 2 + Math.PI / 6;
    v.position.set( Math.sin( a ) * 5.2, 5.0, Math.cos( a ) * 5.2 );
    v.lookAt( Math.sin( a ) * 20, 9, Math.cos( a ) * 20 );
    habitat.add( v );
  }
  base.add( habitat );

  // Laboratorio: cilindro tumbado con tapas y ventanas
  var laboratorio = new THREE.Group();
  laboratorio.position.set( 8, TOP + 2.6, -4 );
  // el extremo oeste se mete dentro del habitat
  var cuerpo = new THREE.Mesh( new THREE.CylinderGeometry( 2.5, 2.5, 13.5, 24 ), matModulo );
  cuerpo.rotation.z = Math.PI / 2;
  cuerpo.position.x = -1.25;
  laboratorio.add( cuerpo );
  var tapa = new THREE.Mesh( new THREE.CylinderGeometry( 2.7, 2.7, 0.5, 24 ), matMetal );
  tapa.rotation.z = Math.PI / 2; tapa.position.x = 5.7;
  laboratorio.add( tapa );
  for ( var k = -3; k <= 3; k += 2 ) {
    var ven = new THREE.Mesh( new THREE.BoxGeometry( 1.2, 0.7, 0.2 ), matVentana );
    ven.position.set( k, 0.6, 2.42 );
    laboratorio.add( ven );
  }
  [ -3.5, 3.5 ].forEach( function( x ) {                // patas
    var pata = new THREE.Mesh( new THREE.BoxGeometry( 0.4, 2.2, 3.6 ), matMetal );
    pata.position.set( x, -1.5, 0 );
    laboratorio.add( pata );
  } );
  base.add( laboratorio );

  // Antena: mastil -> cabezal (gira sobre Y) -> brazo, plato, receptor
  var antena = new THREE.Group();
  antena.position.set( -11, TOP, 6 );
  var mastil = new THREE.Mesh( new THREE.CylinderGeometry( 0.25, 0.35, 8, 12 ), matMetal );
  mastil.position.y = 4;
  var cabezal = new THREE.Group();
  cabezal.position.y = 8;
  var brazo = new THREE.Mesh( new THREE.BoxGeometry( 0.5, 0.5, 1.5 ), matOscuro );
  // el plato se apoya en la cara delantera del brazo y el receptor sale por su eje
  var R = 2.5, elev = 0.6;                             // radio de la esfera y elevacion del eje
  var eje = new THREE.Vector3( 0, Math.sin( elev ), Math.cos( elev ) );
  var vertice = new THREE.Vector3( 0, 0, 0.75 );
  var plato = new THREE.Mesh(
    new THREE.SphereGeometry( R, 32, 12, 0, Math.PI * 2, 0, Math.PI / 5 ),
    new THREE.MeshPhongMaterial( { color: 0xf2f2f2, side: THREE.DoubleSide, shininess: 60 } ) );
  plato.rotation.x = -Math.PI / 2 - elev;              // concavidad hacia delante y arriba
  plato.position.copy( vertice ).addScaledVector( eje, R );   // centro de la esfera
  var receptor = new THREE.Mesh( new THREE.CylinderGeometry( 0.05, 0.05, 1.8, 6 ), matOscuro );
  receptor.rotation.x = Math.PI / 2 - elev;
  receptor.position.copy( vertice ).addScaledVector( eje, 0.9 );
  cabezal.add( brazo, plato, receptor );
  antena.add( mastil, cabezal );
  base.add( antena );

  // Paneles solares: fila de 4, inclinados hacia el sol
  var paneles = new THREE.Group();
  var matSolar = new THREE.MeshLambertMaterial( { map: texturaSolar() } );
  for ( var p = 0; p < 4; p++ ) {
    var lx = -30 + p * 7, lz = -10;
    var panel = new THREE.Group();
    panel.position.set( lx, sueloLocal( lx, lz ), lz );
    var poste = new THREE.Mesh( new THREE.CylinderGeometry( 0.15, 0.15, 2, 8 ), matMetal );
    poste.position.y = 1;
    var placa = new THREE.Mesh( new THREE.BoxGeometry( 6, 0.12, 3.5 ), [ matMetal, matMetal, matSolar, matOscuro, matMetal, matMetal ] );
    placa.position.y = 2;
    placa.rotation.x = -0.5;
    panel.add( poste, placa );
    paneles.add( panel );
  }
  base.add( paneles );

  // Pad de entrega de muestras con balizas
  var pad = new THREE.Group();
  var pz = 26;
  // la cara superior va sobre el punto mas alto del terreno y el bloque baja
  // hasta el mas bajo, para que no quede flotando
  var yMin = Infinity, yMax = -Infinity;
  for ( var sx = -6; sx <= 6; sx += 1 ) for ( var sz = -6; sz <= 6; sz += 1 ) {
    var h = sueloLocal( sx, pz + sz );
    yMin = Math.min( yMin, h ); yMax = Math.max( yMax, h );
  }
  pad.position.set( 0, yMax, pz );
  var altoLosa = 0.4 + ( yMax - yMin ) + 0.5;
  var losa = new THREE.Mesh( new THREE.BoxGeometry( 12, altoLosa, 12 ),
    [ matHormigon, matHormigon, new THREE.MeshLambertMaterial( { map: texturaPeligro() } ), matHormigon, matHormigon, matHormigon ] );
  losa.position.y = 0.4 - altoLosa / 2;
  pad.add( losa );
  var balizas = [];
  var rPoste = 0.12, e = 6 - rPoste;
  [ [ -e, -e ], [ e, -e ], [ -e, e ], [ e, e ] ].forEach( function( c ) {
    var poste = new THREE.Mesh( new THREE.CylinderGeometry( rPoste, rPoste, 1.4, 8 ), matMetal );
    poste.position.set( c[0], 1.1, c[1] );
    var luz = new THREE.Mesh( new THREE.SphereGeometry( 0.28, 12, 8 ),
      new THREE.MeshLambertMaterial( { color: 0xff8a00, emissive: 0xff6a00, emissiveIntensity: 1 } ) );
    luz.position.set( c[0], 1.9, c[1] );
    pad.add( poste, luz );
    balizas.push( luz );
  } );
  var luzPad = new THREE.PointLight( 0xff7a1a, 1.5, 25, 2 );
  luzPad.position.y = 3;
  pad.add( luzPad );
  base.add( pad );

  base.traverse( function( o ) { if ( o.isMesh ) { o.castShadow = true; o.receiveShadow = true; } } );

  base.userData = { cabezal: cabezal, balizas: balizas, luzPad: luzPad, tiempo: 0,
    habitat: habitat, laboratorio: laboratorio, antena: antena, paneles: paneles, pad: pad,
    mastil: mastil, TOP: TOP };
  return base;
}

// ---------- Animacion ----------
function animarBase( base, dt )
{
  var d = base.userData;
  d.tiempo += dt;
  d.cabezal.rotation.y += dt * 0.3;                    // la antena barre el horizonte
  var on = ( d.tiempo % 1.2 ) < 0.6;                   // balizas intermitentes
  d.balizas.forEach( function( b ) { b.material.emissiveIntensity = on ? 1.2 : 0.1; } );
  d.luzPad.intensity = on ? 1.5 : 0.2;
}
