// Tarjetas educativas: al recoger cada muestra sale una tarjeta sobre robotica movil e IA.
// Salen en orden aleatorio, sin repetirse en la misma partida, y el juego queda en pausa
// mientras esta abierta (se cierra con E o Intro). Los textos van en valenciano.

var TARJETAS = [
  { titulo: 'Odometria de rodes',
    texto: 'El ròver calcula quant ha avançat comptant les voltes de les rodes. És senzill, però falla si les rodes patinen. El 2005 Opportunity va quedar atrapat en una duna: les rodes giraven i quasi no avançava.',
    juego: 'les rodes giren segons la distància recorreguda.' },
  { titulo: 'Visió estèreo',
    texto: 'Dos càmeres separades uns centímetres veuen la mateixa escena des de punts un poc diferents. De la diferència entre les dos imatges (la disparitat) s\'obté la distància a cada punt, igual que fan els nostres ulls.',
    juego: 'les dos càmeres del màstil.' },
  { titulo: 'Xarxes neuronals convolucionals',
    texto: 'Una xarxa convolucional aprén filtres que detecten vores, textures i formes, capa a capa, fins a reconéixer objectes sencers. Ningú programa eixos filtres: la xarxa els aprén a partir d\'exemples.',
    juego: 'és la base del detector de la càmera en primera persona.' },
  { titulo: 'Detecció d\'objectes (YOLO)',
    texto: 'Una xarxa neuronal mira la imatge una sola vegada i torna, per a cada objecte, un requadre, una classe i una confiança. S\'entrena amb milers d\'imatges etiquetades a mà.',
    juego: 'els requadres de la càmera en primera persona.' },
  { titulo: 'SLAM: localització i mapa alhora',
    texto: 'En Mart no hi ha GPS. El robot construïx un mapa del que veu i, al mateix temps, estima on està dins d\'eixe mapa. Cada problema necessita la solució de l\'altre, per això es resolen junts.',
    juego: 'el minimapa que seguix el ròver.' },
  { titulo: 'Planificació de rutes',
    texto: 'Algorismes de busca com A* o D* troben el camí de menor cost sobre un mapa de cel·les, evitant obstacles i pendents. Els ròvers de Mart usen variants que recalculen la ruta quan apareix alguna cosa nova.',
    juego: 'tu eres el planificador i tries per on rodejar les roques.' },
  { titulo: 'Fusió de sensors',
    texto: 'Cap sensor és fiable tot sol. El filtre de Kalman combina odometria, sensors inercials i càmeres, i dona més pes al que té menys incertesa en cada moment.',
    juego: 'el ròver sap la seua posició, el seu rumb i la seua inclinació alhora.' },
  { titulo: 'Ciència autònoma',
    texto: 'Des del 2010 Opportunity va portar AEGIS, un programa que analitzava les seues pròpies imatges i triava quines roques valia la pena fotografiar amb detall, sense esperar ordes de la Terra.',
    juego: 'el detector marca les mostres per tu.' },
  { titulo: 'Classificació del terreny',
    texto: 'Una xarxa de segmentació semàntica etiqueta cada píxel de la imatge: arena, roca, sòl ferm. Així el ròver sap on pot afonar-se abans de xafar-ho.',
    juego: 'les dunes del fons del cràter i la plana ferma del voltant.' },
  { titulo: 'Aprenentatge per reforç',
    texto: 'Un agent prova accions, rep una recompensa quan ho fa bé i, a poc a poc, aprén una estratègia. Hi ha robots que han aprés així a caminar. En Mart encara no s\'usa: un error allí no es pot desfer.',
    juego: 'tu també aprens provant, i la teua recompensa són els punts.' },
  { titulo: 'Simulació i bessó digital',
    texto: 'Abans d\'enviar una orde a Mart, es prova en un simulador i en una còpia del ròver a la Terra. La IA també s\'entrena en simulació i després es transferix al robot real.',
    juego: 'este joc és un simulador xicotet sobre el relleu real del cràter Victoria.' },
  { titulo: 'Suspensió rocker-bogie',
    texto: 'Sis rodes unides per balancins sense molls. El sistema repartix el pes i manté totes les rodes en contacte amb el sòl, encara que una puge a una roca.',
    juego: 'les barres que unixen les rodes al xassís.' },
  { titulo: 'Braç robòtic i cinemàtica inversa',
    texto: 'Per a portar la ferramenta a un punt cal calcular quin angle ha de tindre cada articulació. Eixe càlcul, de la posició desitjada als angles, és la cinemàtica inversa.',
    juego: 'el canyell i el colze giren per a arreplegar la mostra.' },
  { titulo: 'Energia',
    texto: 'Els panells solars carreguen la bateria, però la pols els va tapant. Cada dia el ròver repartix l\'energia entre moure\'s, calfar-se i comunicar-se. Una tempesta de pols va acabar amb Opportunity el 2018.',
    juego: 'els panells solars del ròver i de la base.' },
  { titulo: 'Comunicacions i autonomia',
    texto: 'Un senyal tarda entre 4 i 24 minuts a arribar de la Terra a Mart. No es pot conduir un ròver amb un comandament: cal donar-li objectius i deixar que decidisca sol. Per això la IA és imprescindible allí.',
    juego: 'l\'antena de la base.' },
  { titulo: 'Què conten les mostres',
    texto: 'Les esfèrules d\'hematites i els sulfats només es formen amb aigua. Opportunity les va trobar en esta zona i va demostrar que Mart va tindre aigua líquida fa milers de milions d\'anys.',
    juego: 'les mostres que portes a la base.' }
];

var tarjetaAbierta = false;       // mientras es true el juego esta en pausa (ver update en main.js)
var ordenTarjetas = [];           // indices de TARJETAS barajados para esta partida
var siguienteTarjeta = 0;

// Baraja (Fisher-Yates) el orden de las tarjetas al cargar
barajarTarjetas();
function barajarTarjetas()
{
  ordenTarjetas = [];
  siguienteTarjeta = 0;
  for ( var i = 0; i < TARJETAS.length; i++ ) ordenTarjetas.push( i );
  for ( i = ordenTarjetas.length - 1; i > 0; i-- ) {
    var j = Math.random() * ( i + 1 ) | 0, aux = ordenTarjetas[i];
    ordenTarjetas[i] = ordenTarjetas[j]; ordenTarjetas[j] = aux;
  }
}

function mostrarTarjeta()
{
  if ( siguienteTarjeta >= ordenTarjetas.length ) return;    // ya se han visto todas
  var t = TARJETAS[ ordenTarjetas[ siguienteTarjeta++ ] ];
  document.getElementById( 'tarjetaTitulo' ).textContent = t.titulo;
  document.getElementById( 'tarjetaTexto' ).textContent = t.texto;
  document.getElementById( 'tarjetaJuego' ).innerHTML = '<b>En el joc:</b> ' + t.juego;
  document.getElementById( 'tarjeta' ).style.display = 'block';
  document.getElementById( 'mensaje' ).style.display = 'none';   // sin avisos debajo de la tarjeta
  textoMensaje = '';
  tarjetaAbierta = true;
}

function cerrarTarjeta()
{
  document.getElementById( 'tarjeta' ).style.display = 'none';
  tarjetaAbierta = false;
}
