const room = (number, wing, x, y, width=34, height=28, options={}) => ({
  number:String(number), wing, x, y, width, height, ...options
});

const polygonRoom = (number, wing, points, options={}) => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  return room(number, wing, x, y, width, height, {points, ...options});
};

const connection = (from, to, wing, type='door', options={}) => ({from:String(from), to:String(to), wing, type, ...options});
const connectionChain = (numbers, wing, type='door') => numbers.slice(1).map((number, index) => connection(numbers[index], number, wing, type));

const facility = (type, x, y, label='', options={}) => ({type, x, y, label, ...options});
const door = (x1, y1, x2, y2) => ({x1, y1, x2, y2});

export const FLOOR_MAP_VIEWBOX = Object.freeze({x:0, y:0, width:960, height:600});

export const floorPlans = Object.freeze({
  2: {
    subtitle:'絵画展示階',
    outline:'M66 104H430l46 28h115l38-30h256v249H665l-34-26H472l-43 29H66z',
    wings:[
      {id:'richelieu', label:'リシュリュー翼', range:'800-864室', labelX:82, labelY:88},
      {id:'sully', label:'シュリー翼', range:'900-952室', labelX:770, labelY:88}
    ],
    corridors:[
      'M88 172H432L489 198H622',
      'M478 198V314H631V198',
      'M622 198L650 174H826L865 214L850 254H666L642 226Z'
    ],
    rooms:[
      room(864,'richelieu',92,145,62,27), room(855,'richelieu',154,145,55,27),
      room(848,'richelieu',209,145,50,27), room(845,'richelieu',259,145,48,27),
      room(843,'richelieu',307,145,45,27), room(836,'richelieu',352,145,43,27),
      room(835,'richelieu',395,145,38,27), room(800,'richelieu',102,172,47,31),
      room(801,'richelieu',149,172,47,31), room(802,'richelieu',196,172,47,31),
      room(803,'richelieu',243,172,48,31), room(814,'richelieu',291,172,54,31),
      room(818,'richelieu',345,172,48,31), room(823,'richelieu',393,172,47,31),
      room(825,'richelieu',440,172,38,31), room(830,'richelieu',440,203,38,31),
      room(837,'richelieu',352,118,43,27),
      polygonRoom(902,'sully',[[576,174],[613,174],[622,194],[585,194]],{labelX:598,labelY:184}),
      polygonRoom(900,'sully',[[603,194],[638,194],[646,218],[611,218]],{labelX:625,labelY:206}),
      polygonRoom(909,'sully',[[650,160],[694,160],[694,188],[650,188]]),
      polygonRoom(912,'sully',[[694,160],[738,160],[738,188],[694,188]]),
      polygonRoom(913,'sully',[[738,160],[782,160],[782,188],[738,188]]),
      polygonRoom(917,'sully',[[782,160],[826,160],[830,188],[782,188]]),
      polygonRoom(931,'sully',[[826,160],[850,172],[878,232],[850,240],[830,188]]),
      polygonRoom(940,'sully',[[806,240],[850,240],[860,268],[812,268]]),
      polygonRoom(952,'sully',[[762,240],[806,240],[812,268],[762,268]]),
      polygonRoom(944,'sully',[[714,240],[762,240],[762,268],[714,268]]),
      polygonRoom(936,'sully',[[666,240],[714,240],[714,268],[660,264]]),
      polygonRoom(924,'sully',[[650,160],[650,188],[666,214],[666,240],[638,230],[622,188]],{labelX:647,labelY:208})
    ],
    connections:[
      ...connectionChain([864,855,848,845,843,836,835],'richelieu'),
      ...connectionChain([800,801,802,803,814,818,823,825,830],'richelieu'),
      connection(902,900,'sully'),
      connection(900,924,'sully'),
      connection(924,909,'sully'),
      ...connectionChain([909,912,913,917,931,940,952,944,936,924],'sully')
    ],
    doors:[
      door(149,169,149,177), door(196,169,196,177), door(243,169,243,177),
      door(291,169,291,177), door(345,169,345,177), door(393,169,393,177),
      door(437,184,445,184), door(609,184,617,184), door(620,198,628,198),
      door(646,181,654,181), door(690,181,698,181), door(734,181,742,181),
      door(778,181,786,181), door(826,181,834,185), door(850,236,858,240),
      door(808,251,816,251), door(758,251,766,251), door(710,251,718,251),
      door(662,247,670,247), door(638,226,646,226)
    ],
    facilities:[
      facility('stairs',450,189), facility('elevator',477,189), facility('stairs',611,189),
      facility('stairs',650,239), facility('elevator',650,286), facility('stairs',700,333),
      facility('wc',521,188), facility('wc',602,327), facility('closed',844,327,'工事中')
    ],
    labels:[
      {x:256,y:112,text:'絵画／北ヨーロッパ'}, {x:718,y:112,text:'絵画／フランス'},
      {x:476,y:351,text:'企画展 時計の展示室'}
    ]
  },
  1: {
    subtitle:'美術館・企画展',
    outline:'M60 95H430l48 28h124l41-31h247v238H704l-45-25H484l-44 30H64V488H174l30-47h468l32 29h187v62H176l-34-31H60z',
    wings:[
      {id:'richelieu', label:'リシュリュー翼', range:'500-564室', labelX:76, labelY:78},
      {id:'sully', label:'シュリー翼', range:'600-663室', labelX:775, labelY:78},
      {id:'denon', label:'ドゥノン翼', range:'700-734室', labelX:76, labelY:558}
    ],
    corridors:[
      'M88 165H435L487 194H632L668 165H862',
      'M487 194V320H632V194',
      'M632 320L672 397H843',
      'M487 320L439 397H186',
      'M186 421H672'
    ],
    rooms:[
      room(564,'richelieu',91,137,57,28), room(558,'richelieu',148,137,48,28),
      room(557,'richelieu',196,137,46,28), room(552,'richelieu',242,137,43,28),
      room(548,'richelieu',285,137,45,28), room(544,'richelieu',330,137,47,28),
      room(535,'richelieu',377,137,57,28), room(500,'richelieu',102,165,45,31),
      room(501,'richelieu',147,165,43,31), room(503,'richelieu',190,165,44,31),
      room(505,'richelieu',234,165,43,31), room(507,'richelieu',277,165,43,31),
      room(516,'richelieu',320,165,48,31), room(517,'richelieu',368,165,43,31),
      room(519,'richelieu',411,165,43,31), room(526,'richelieu',454,165,45,31),
      room(531,'richelieu',454,196,45,31),
      polygonRoom(600,'sully',[[632,158],[680,151],[686,179],[639,186]]),
      polygonRoom(601,'sully',[[680,151],[727,146],[733,174],[686,179]]),
      polygonRoom(605,'sully',[[727,146],[773,143],[780,171],[733,174]]),
      polygonRoom(606,'sully',[[773,143],[817,142],[825,170],[780,171]]),
      polygonRoom(617,'sully',[[817,142],[859,147],[867,175],[825,170]]),
      polygonRoom(632,'sully',[[632,158],[639,186],[641,224],[613,220]]),
      polygonRoom(633,'sully',[[613,220],[641,224],[644,262],[616,258]]),
      polygonRoom(635,'sully',[[616,258],[644,262],[649,301],[621,297]]),
      polygonRoom(636,'sully',[[621,297],[649,301],[690,315],[680,345],[632,327]]),
      polygonRoom(640,'sully',[[680,315],[726,320],[724,350],[680,345]]),
      polygonRoom(641,'sully',[[726,320],[771,322],[770,352],[724,350]]),
      polygonRoom(645,'sully',[[771,322],[817,320],[820,350],[770,352]]),
      polygonRoom(650,'sully',[[817,320],[854,311],[864,339],[820,350]]),
      polygonRoom(651,'sully',[[854,283],[887,278],[891,306],[854,311]]),
      polygonRoom(652,'sully',[[855,255],[888,251],[887,278],[854,283]]),
      polygonRoom(656,'sully',[[857,227],[890,224],[888,251],[855,255]]),
      polygonRoom(660,'sully',[[859,199],[892,197],[890,224],[857,227]]),
      polygonRoom(661,'sully',[[861,172],[894,171],[892,197],[859,199]]),
      polygonRoom(663,'sully',[[859,147],[896,151],[894,171],[861,172]]),
      room(734,'denon',151,397,48,28), room(727,'denon',199,397,45,28),
      room(726,'denon',244,397,45,28), room(720,'denon',289,397,47,28),
      room(719,'denon',336,397,45,28), room(718,'denon',381,397,45,28),
      room(717,'denon',426,397,45,28), room(716,'denon',471,397,45,28),
      room(715,'denon',516,397,45,28), room(713,'denon',561,397,45,28),
      room(712,'denon',606,397,46,28), room(711,'denon',652,397,48,28),
      room(710,'denon',179,425,46,31), room(709,'denon',225,425,45,31),
      room(708,'denon',270,425,46,31), room(706,'denon',316,425,46,31),
      room(705,'denon',362,425,47,31), room(703,'denon',409,425,49,31),
      room(702,'denon',458,425,46,31), room(701,'denon',504,425,46,31),
      room(700,'denon',550,425,49,31), room(706,'denon',599,425,45,31,{part:'east'})
    ],
    connections:[
      ...connectionChain([564,558,557,552,548,544,535],'richelieu'),
      ...connectionChain([500,501,503,505,507,516,517,519,526,531],'richelieu'),
      ...connectionChain([600,601,605,606,617,663,661,660,656,652,651,650,645,641,640,636,635,633,632,600],'sully'),
      ...connectionChain([734,727,726,720,719,718,717,716,715,713,712,711],'denon'),
      ...connectionChain([710,709,708,706,705,703,702,701,700],'denon')
    ],
    doors:[
      ...[147,190,234,277,320,368,411,454].map(x=>door(x,162,x,170)),
      ...[680,727,773,817,862].map(x=>door(x,162,x,170)),
      door(656,201,656,209), door(656,239,656,247), door(656,279,656,287),
      ...[199,244,289,336,381,426,471,516,561,606,652].map(x=>door(x,394,x,402)),
      ...[225,270,316,362,409,458,504,550,599].map(x=>door(x,422,x,430))
    ],
    facilities:[
      facility('stairs',470,184), facility('elevator',500,184), facility('escalator',606,184),
      facility('stairs',654,222), facility('elevator',654,270), facility('wc',590,317),
      facility('stairs',448,409), facility('stairs',486,445), facility('elevator',623,409),
      facility('wc',210,445), facility('closed',852,514,'工事中')
    ],
    labels:[
      {x:282,y:112,text:'装飾美術／ヨーロッパ'}, {x:731,y:112,text:'古代エジプト美術'},
      {x:310,y:491,text:'絵画／イタリア・スペイン'}, {x:590,y:491,text:'絵画／フランス'}
    ]
  },
  0: {
    subtitle:'美術館・企画展',
    outline:'M54 97H427l53 30h118l43-31h252v247H707l-50-29H485l-47 31H62V489H174l31-48h466l35 31h187v60H177l-38-31H54z',
    wings:[
      {id:'richelieu', label:'リシュリュー翼', range:'200-236室', labelX:73, labelY:78},
      {id:'sully', label:'シュリー翼', range:'300-348室', labelX:775, labelY:78},
      {id:'denon', label:'ドゥノン翼', range:'400-433室', labelX:73, labelY:558}
    ],
    corridors:[
      'M91 171H432L486 198H631L669 171H864',
      'M486 198V320H631V198',
      'M631 320L674 398H843',
      'M486 320L438 398H184',
      'M184 422H676'
    ],
    rooms:[
      room(200,'richelieu',96,143,55,28), room(201,'richelieu',151,143,50,28),
      room(206,'richelieu',201,143,49,28), room(212,'richelieu',250,143,48,28),
      room(218,'richelieu',298,143,48,28), room(219,'richelieu',346,143,43,28),
      room(226,'richelieu',389,143,43,28), room(229,'richelieu',432,143,45,28),
      room(230,'richelieu',96,171,57,31), room(231,'richelieu',153,171,58,31),
      room(234,'richelieu',211,171,58,31), room(236,'richelieu',269,171,58,31),
      polygonRoom(300,'sully',[[631,160],[679,153],[685,181],[638,188]]),
      polygonRoom(305,'sully',[[679,153],[726,148],[732,176],[685,181]]),
      polygonRoom(308,'sully',[[726,148],[773,145],[780,173],[732,176]]),
      polygonRoom(312,'sully',[[773,145],[818,145],[826,173],[780,173]]),
      polygonRoom(316,'sully',[[818,145],[862,149],[870,177],[826,173]]),
      polygonRoom(317,'sully',[[862,149],[894,158],[899,186],[870,177]]),
      polygonRoom(321,'sully',[[870,177],[899,186],[895,226],[866,218]]),
      polygonRoom(323,'sully',[[866,218],[895,226],[891,266],[862,258]]),
      polygonRoom(328,'sully',[[862,258],[891,266],[882,306],[854,296]]),
      polygonRoom(337,'sully',[[854,296],[882,306],[858,337],[830,326]]),
      polygonRoom(338,'sully',[[636,299],[681,312],[679,342],[628,327]]),
      polygonRoom(339,'sully',[[681,312],[726,318],[724,348],[679,342]]),
      polygonRoom(345,'sully',[[726,318],[772,321],[771,351],[724,348]]),
      polygonRoom(347,'sully',[[772,321],[815,320],[820,350],[771,351]]),
      polygonRoom(348,'sully',[[815,320],[830,326],[858,337],[820,350]]),
      room(433,'denon',151,398,48,28), room(427,'denon',199,398,48,28),
      room(424,'denon',247,398,47,28), room(423,'denon',294,398,46,28),
      room(419,'denon',340,398,46,28), room(418,'denon',386,398,46,28),
      room(417,'denon',432,398,46,28), room(413,'denon',478,398,47,28),
      room(410,'denon',525,398,48,28), room(408,'denon',573,398,45,28),
      room(406,'denon',618,398,45,28), room(405,'denon',663,398,45,28),
      room(403,'denon',177,426,50,31), room(402,'denon',227,426,50,31),
      room(400,'denon',277,426,52,31)
    ],
    connections:[
      ...connectionChain([200,201,206,212,218,219,226,229],'richelieu'),
      ...connectionChain([230,231,234,236],'richelieu'),
      ...connectionChain([300,305,308,312,316,317,321,323,328,337,348,347,345,339,338],'sully'),
      connection(338,'corridor:sully-west','sully','corridor',{points:[[636,313],[615,255],[633,174]]}),
      connection('corridor:sully-west',300,'sully','corridor',{points:[[633,174],[638,174]]}),
      ...connectionChain([433,427,424,423,419,418,417,413,410,408,406,405],'denon'),
      ...connectionChain([403,402,400],'denon')
    ],
    doors:[
      ...[151,201,250,298,346,389,432].map(x=>door(x,140,x,148)),
      ...[679,726,773,818,864].map(x=>door(x,140,x,148)),
      door(655,209,655,217), door(655,249,655,257), door(655,290,655,298),
      ...[199,247,294,340,386,432,478,525,573,618,663].map(x=>door(x,395,x,403)),
      door(227,423,227,431), door(277,423,277,431)
    ],
    facilities:[
      facility('stairs',469,189), facility('elevator',502,189), facility('escalator',607,189),
      facility('stairs',653,231), facility('elevator',653,276), facility('wc',591,318),
      facility('stairs',452,410), facility('elevator',623,410), facility('wc',212,445),
      facility('closed',853,514,'工事中')
    ],
    labels:[
      {x:270,y:113,text:'彫刻／フランス'}, {x:744,y:113,text:'古代オリエント美術'},
      {x:315,y:491,text:'彫刻／ヨーロッパ'}, {x:589,y:491,text:'古代ローマ美術'}
    ]
  },
  '-1': {
    subtitle:'美術館・企画展',
    outline:'M75 112H410l61 36h132l55-36h231v211H710l-52-27H474l-55 33H75V468H186l34-50h451l37 31h181v66H181l-36-31H75z',
    wings:[
      {id:'richelieu', label:'リシュリュー翼', range:'100-106室', labelX:80, labelY:92},
      {id:'sully', label:'シュリー翼', range:'130-137室', labelX:775, labelY:92},
      {id:'denon', label:'ドゥノン翼', range:'160-187室', labelX:80, labelY:548}
    ],
    corridors:[
      'M215 194H416L480 220H620L672 194H850',
      'M480 220V326H620V220',
      'M480 326L430 406H218',
      'M620 326L675 406H842',
      'M218 430H675'
    ],
    rooms:[
      room(100,'richelieu',218,166,51,28), room(101,'richelieu',269,166,49,28),
      room(102,'richelieu',318,166,51,28), room(104,'richelieu',369,166,49,28),
      room(105,'richelieu',418,166,43,28), room(106,'richelieu',418,194,43,30),
      room(130,'sully',620,166,48,28), room(131,'sully',668,166,47,28),
      room(132,'sully',715,166,45,28), room(133,'sully',760,166,47,28),
      room(134,'sully',807,166,43,28), room(135,'sully',850,166,42,28),
      room(137,'sully',620,194,48,42),
      room(160,'denon',400,378,54,28), room(164,'denon',346,378,54,28),
      room(169,'denon',292,378,54,28), room(170,'denon',454,378,49,28),
      room(173,'denon',503,378,46,28), room(174,'denon',549,378,46,28),
      room(179,'denon',595,378,45,28), room(180,'denon',640,378,48,28),
      room(181,'denon',688,378,44,28), room(183,'denon',732,378,44,28),
      room(185,'denon',776,378,44,28), room(186,'denon',400,406,48,31)
    ],
    connections:[
      ...connectionChain([100,101,102,104,105,106],'richelieu'),
      ...connectionChain([130,131,132,133,134,135],'sully'),
      connection(130,137,'sully'),
      ...connectionChain([169,164,160,170,173,174,179,180,181,183,185],'denon'),
      connection(160,186,'denon')
    ],
    doors:[
      ...[269,318,369,418].map(x=>door(x,163,x,171)),
      ...[668,715,760,807,850].map(x=>door(x,163,x,171)),
      door(458,205,466,205), door(617,207,625,207),
      ...[346,400,454,503,549,595,640,688,732,776].map(x=>door(x,375,x,383))
    ],
    facilities:[
      facility('stairs',447,209), facility('elevator',478,209), facility('escalator',605,209),
      facility('stairs',490,308), facility('elevator',555,308), facility('wc',580,341),
      facility('stairs',430,392), facility('stairs',665,392), facility('wc',252,420),
      facility('studio',535,139,'ステュディオ'), facility('closed',852,497,'工事中')
    ],
    labels:[
      {x:308,y:135,text:'彫刻／フランス'}, {x:742,y:135,text:'ルーヴル宮の歴史'},
      {x:327,y:470,text:'古代ギリシア美術'}, {x:570,y:470,text:'イスラム美術'}
    ]
  },
  '-2': {
    subtitle:'受付・企画展',
    outline:'M154 145H403l66 37h119l67-37h181v79h57v143h-57v78H655l-67-37H469l-66 37H154V367H92V224h62z',
    wings:[
      {id:'richelieu', label:'リシュリュー翼入口', range:'', labelX:350, labelY:124},
      {id:'sully', label:'シュリー翼入口', range:'', labelX:718, labelY:124},
      {id:'denon', label:'ドゥノン翼入口', range:'', labelX:454, labelY:493}
    ],
    corridors:[
      'M190 292H768', 'M486 190V410', 'M315 224V367', 'M655 224V367'
    ],
    rooms:[],
    connections:[],
    doors:[
      door(310,272,320,272), door(310,312,320,312), door(650,272,660,272),
      door(650,312,660,312), door(481,219,491,219), door(481,363,491,363)
    ],
    facilities:[
      facility('information',468,286,'案内所'), facility('ticket',430,325,'チケット売場'),
      facility('cloak',365,286,'クローク'), facility('friends',410,260,'ルーヴル友の会'),
      facility('auditorium',615,260,'オーディトリアム'), facility('group',564,325,'団体受付'),
      facility('shop',322,325,'書店／売店'), facility('stairs',451,219),
      facility('elevator',516,219), facility('escalator',550,286), facility('wc',590,286),
      facility('metro',195,292,'地下鉄'), facility('exit',255,292,'出口')
    ],
    labels:[
      {x:268,y:194,text:'Hall Napoléon'}, {x:674,y:194,text:'企画展'},
      {x:486,y:384,text:'ピラミッド中央入口'}
    ]
  }
});

export const officialRoomNumbers = Object.freeze(Object.fromEntries(
  Object.entries(floorPlans).map(([floor, plan]) => [floor, [...new Set(plan.rooms.map(item => item.number))]])
));
