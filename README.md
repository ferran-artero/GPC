# GPC – Gràfics per Computador

Pràctiques i projecte personal de l'assignatura **Gràfics per Computador** (MIARFID, UPV), fets amb [Three.js](https://threejs.org/) r140.

Autor: Ferran Artero Merino

## Què hi ha

| Pàgina | Contingut |
|---|---|
| [sol951.html](https://ferran-artero.github.io/GPC/sol951.html) | **Sol 951**, el projecte personal: un joc d'exploració a Mart |
| [fartmer_P2_GrafoEscena.html](https://ferran-artero.github.io/GPC/fartmer_P2_GrafoEscena.html) | P2 – Braç robòtic construït amb un graf d'escena |
| [fartmer_P3_MovimientoCamara.html](https://ferran-artero.github.io/GPC/fartmer_P3_MovimientoCamara.html) | P3 – Càmera orbital i vista zenital en miniatura |
| [fartmer_P4_Interaccion.html](https://ferran-artero.github.io/GPC/fartmer_P4_Interaccion.html) | P4 – Interfície de control, teclat i animació |
| [fartmer_P5_LucesMateriales.html](https://ferran-artero.github.io/GPC/fartmer_P5_LucesMateriales.html) | P5 – Llums, ombres, textures i mapa d'entorn |

## Sol 951

Controles un ròver inspirat en **Opportunity** al **cràter Victoria** de Mart. Has de trobar les 12 mostres repartides pel mapa, arreplegar-les amb el braç i portar-les a la zona de mostres de la base abans que s'acabe la bateria. Cada mostra que arreplegues obri una targeta que explica un concepte de robòtica mòbil, d'intel·ligència artificial, de Mart o de la missió d'Opportunity.

### Controls

| Tecla | Acció |
|---|---|
| W A S D / fletxes | Conduir |
| Espai | Propulsors (gasten molta bateria) |
| E | Arreplegar una mostra / entregar-les a la base |
| C | Canviar entre càmera en tercera persona i càmera del màstil |
| Intro | Començar / tornar a jugar |

### Regles

- Hi ha tres tipus de mostra, cadascun en una zona: **hematites** a la plana (10 punts), **sulfat** a les parets del cràter (25) i **meteorit** al fons (50).
- El ròver porta com a màxim 3 mostres. S'entreguen totes de colp posant-se damunt de la zona de mostres.
- La bateria baixa sempre, més de pressa conduint i molt més volant. Cada mostra entregada en recarrega una part.
- La càmera del màstil simula un detector d'objectes: marca les mostres i la zona d'entrega amb un requadre, la confiança i la distància.
- Les roques i els edificis de la base són obstacles. Les parets del cràter són massa dretes per a pujar-les rodant: cal volar.

### Com està fet

- **Terreny.** És el cràter Victoria real: un model digital d'elevacions i una ortoimatge de la càmera HiRISE, reduïts a un mapa d'altures de 512 × 512 i una textura de 2048 × 2048 (`mapa/procesar_mapa.py`). El mapa fa 1 km de costat i no té exageració vertical; una unitat de l'escena és un metre.
- **Graf d'escena.** El ròver és una jerarquia de grups: xassís, coberta solar, màstil amb les dos càmeres, braç articulat (muscle, colze, canell) i suspensió *rocker-bogie* amb sis rodes, quatre de les quals giren per a dirigir. La base (hàbitat, laboratori, antena, panells i zona de mostres), les roques i les mostres són grups a banda.
- **Càmeres.** Una en tercera persona que seguix el ròver amb suavitzat, una en primera persona filla del màstil, i un minimapa amb càmera ortogràfica zenital en un segon *viewport* que gira amb el ròver.
- **Moviment.** El ròver es recolza en el terreny mostrejant l'altura en quatre punts, cosa que també li dona el capcineig i el balanceig. El vol és una simulació senzilla amb empenta i la gravetat de Mart, sense motor de física.
- **Col·lisions.** Amb `THREE.Raycaster`: abans d'avançar es llancen rajos en la direcció del moviment contra les roques i la base, i el ròver només es mou si no hi ha res davant. Un altre raig cap avall dona l'altura quan està damunt de la base.
- **Animació.** Les rodes giren segons la distància recorreguda, el braç baixa i puja amb Tween.js, l'antena de la base gira i les balises fan pampallugues.
- **Llums i materials.** Sol direccional amb ombres que seguixen el ròver, llum ambient de dos tons, llums puntuals als propulsors i a la zona de mostres, materials Lambert i Phong, i boira del color del cel. Les textures que no són del terreny es dibuixen en un *canvas*.
- **Detecció.** No hi ha cap xarxa neuronal: es projecten a la pantalla les huit cantonades de la caixa de cada objecte amb les matrius de la càmera i es dibuixa el rectangle que les conté.

## Estructura

```
sol951.html, fartmer_P*.html   pàgines
js/                            codi de les pràctiques
js/sol951/                     codi del joc
lib/                           Three.js r140, OrbitControls, lil-gui, Tween.js
images/                        textures de la P5
mapa/                          terreny del joc i script que el genera
```

## Executar-ho en local

El joc carrega el terreny i les textures amb peticions HTTP, així que cal un servidor local:

```
python -m http.server
```

i obrir `http://localhost:8000/sol951.html`.

## Crèdits

- Dades del terreny: HiRISE, NASA/JPL/University of Arizona (DTEEC_021747_1780_022380_1780 i ESP_021747_1780). Els fitxers originals no estan al repositori perquè pesen massa; es poden baixar del web de HiRISE i posar-los a `mapa/` per a regenerar el terreny.
- Biblioteques: Three.js, Tween.js i lil-gui.
