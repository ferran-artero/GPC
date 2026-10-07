// Estado de la partida, bateria y pantallas de inicio y de final
// estadoJuego: 'inicio' -> 'jugando' -> 'fin' (bateria agotada o todo entregado)

var estadoJuego = 'inicio';

// Bateria en % y consumos en % por segundo
var bateria = 100;
var GASTO_REPOSO = 0.12;
var GASTO_CONDUCIR = 0.18;        // a velocidad maxima
var GASTO_VOLAR = 0.5;
var RECARGA_ENTREGA = 20;         // por cada muestra entregada
var bateriaPintada = -1;

function actualizarBateria( rover, dt )
{
  var gasto = GASTO_REPOSO
            + GASTO_CONDUCIR * Math.abs( rover.userData.velocidad ) / VEL_MAX
            + ( controls.volar ? GASTO_VOLAR : 0 );
  bateria = Math.max( 0, bateria - gasto * dt );
  pintarBateria();
  if ( bateria <= 0 ) finPartida( false );
}

function recargarBateria( cantidad )
{
  bateria = Math.min( 100, bateria + cantidad );
  pintarBateria();
}

// La pila del HUD: el relleno se acorta y pasa de verde a amarillo y a rojo
function pintarBateria()
{
  var valor = Math.ceil( bateria );
  if ( valor === bateriaPintada ) return;
  bateriaPintada = valor;
  var relleno = document.getElementById( 'bateriaRelleno' );
  relleno.style.width = valor + '%';
  relleno.style.background = valor > 50 ? '#5dff8f' : valor > 20 ? '#ffd23f' : '#ff5c4d';
  document.getElementById( 'bateriaTexto' ).textContent = valor + ' %';
}

function comenzarPartida()
{
  document.getElementById( 'pantallaInicio' ).style.display = 'none';
  estadoJuego = 'jugando';
}

function finPartida( completada )
{
  estadoJuego = 'fin';
  document.getElementById( 'finTitulo' ).textContent = completada ? 'Missió completada!' : 'Bateria esgotada';
  document.getElementById( 'finTexto' ).textContent = completada
    ? 'Has portat totes les mostres a la base.'
    : 'El ròver s\'ha quedat sense energia.';
  document.getElementById( 'finDatos' ).innerHTML =
    'Punts: <b>' + puntos + '</b> &nbsp;·&nbsp; Mostres entregades: <b>' + entregadas + '/' + muestras.children.length + '</b>';
  document.getElementById( 'mensaje' ).style.display = 'none';
  document.getElementById( 'pantallaFin' ).style.display = 'flex';
}

// Volver a jugar: se recarga la pagina saltando la pantalla inicial
function jugarOtraVez()
{
  sessionStorage.setItem( 'saltarInicio', '1' );
  location.reload();
}

document.getElementById( 'botonComenzar' ).addEventListener( 'click', comenzarPartida );
document.getElementById( 'botonOtraVez' ).addEventListener( 'click', jugarOtraVez );
window.addEventListener( 'keydown', function( e ) {
  if ( e.code !== 'Enter' && e.code !== 'NumpadEnter' ) return;
  if ( estadoJuego === 'inicio' ) comenzarPartida();
  else if ( estadoJuego === 'fin' ) jugarOtraVez();
} );

if ( sessionStorage.getItem( 'saltarInicio' ) ) {
  sessionStorage.removeItem( 'saltarInicio' );
  comenzarPartida();
}
pintarBateria();
