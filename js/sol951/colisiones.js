// Colisiones con Raycaster: antes de avanzar se lanzan rayos en la direccion del
// movimiento contra objectsToCheck y el rover solo se mueve si no hay nada delante.
// La altura del suelo sale del heightmap y, sobre la base, de un rayo hacia abajo.

var raycaster = new THREE.Raycaster();
var objectsToCheck = [];      // rocas y base
var objetosSuelo = [];        // donde el rover se puede posar ademas del terreno

var ROVER_RADIO = 0.85;       // del centro al morro (m)
var ESCALON = 0.45;           // desnivel maximo que sube rodando
var ABAJO = new THREE.Vector3( 0, -1, 0 );

function hayObstaculo( rover, dir, distancia )
{
  // tres rayos a la altura de las ruedas y uno a la del mastil
  var lado = new THREE.Vector3( dir.z, 0, -dir.x ).normalize().multiplyScalar( 0.6 );
  var bajo = rover.position.clone();
  bajo.y += 0.25;
  var alto = rover.position.clone();
  alto.y += 1.4;
  var origenes = [ bajo, bajo.clone().add( lado ), bajo.clone().sub( lado ), alto ];

  for ( var i = 0; i < origenes.length; i++ ) {
    raycaster.set( origenes[i], dir );
    var intersects = raycaster.intersectObjects( objectsToCheck, true );
    if ( intersects.length > 0 && intersects[0].distance <= distancia ) return true;
  }
  return false;
}

// Altura de lo que hay en la base bajo el punto (x, y, z). El rayo sale un escalon
// por encima: lo que quede mas alto es una pared, no suelo
function alturaEstructuras( x, y, z )
{
  raycaster.set( new THREE.Vector3( x, y + ESCALON, z ), ABAJO );
  var intersects = raycaster.intersectObjects( objetosSuelo, true );
  if ( intersects.length > 0 ) return intersects[0].point.y;
  return -Infinity;
}

function alturaSuelo( x, y, z )
{
  return Math.max( getAltura( x, z ), alturaEstructuras( x, y, z ) );
}
