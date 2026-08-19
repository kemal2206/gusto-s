/**
 * ÜRETİLMİŞ DOSYA — elle düzenleme. `npm run data:families -- --write` ile yenile.
 *
 * Aroma ailelerinin Ahn et al. (2011) bileşik künyesindeki karşılıkları.
 * Kaynak: Scientific Reports 1:196, doi:10.1038/srep00196
 */

export const FAMILY_COMPOUNDS: Record<string, number[]> = {
  "sitrus-terpen": [
    348,
    361,
    673
  ],
  "linalol": [
    434,
    586
  ],
  "recineli-pinen": [
    171,
    177,
    238
  ],
  "sineol": [
    602,
    1067
  ],
  "mentol": [
    90,
    540,
    791
  ],
  "kekik-fenolu": [
    426,
    1011,
    1012
  ],
  "anetol": [
    576,
    700,
    715
  ],
  "ojenol": [
    165,
    587
  ],
  "biberli-odunsu": [
    101,
    718
  ],
  "gul-terpeni": [
    606,
    954,
    996,
    1015
  ],
  "safranal": [],
  "zencefil-terpeni": [],
  "tarhun-estragol": [
    240,
    700
  ],
  "allil-sulfur": [
    175,
    472,
    613,
    976
  ],
  "izotiyosiyanat": [
    117,
    475
  ],
  "lahana-sulfur": [
    560
  ],
  "metional": [
    104,
    285
  ],
  "kavrulmus-tiyol": [
    188,
    1000
  ],
  "pirazin": [
    40,
    173,
    556
  ],
  "furfural": [
    703,
    990
  ],
  "maltol": [
    861
  ],
  "hmf-pekmez": [
    302,
    690
  ],
  "malt-aldehit": [
    108,
    764
  ],
  "et-suyu-furanonu": [
    341,
    594
  ],
  "pirol-tahil": [
    173,
    960,
    1020
  ],
  "yesil-heksanal": [
    228,
    235,
    761
  ],
  "yagli-aldehit": [
    554,
    657,
    670
  ],
  "mantar-oktenol": [
    203,
    978
  ],
  "toprak-geosmin": [],
  "deniz-aldehiti": [
    272,
    410
  ],
  "bromofenol-deniz": [
    204
  ],
  "meyveli-ester": [
    86,
    317,
    610
  ],
  "muzlu-ester": [
    56,
    768
  ],
  "seftali-laktonu": [
    218,
    241,
    880
  ],
  "damaskenon": [
    415,
    521,
    541
  ],
  "badem-benzaldehiti": [
    611,
    1070
  ],
  "uzum-antranilati": [
    111,
    227
  ],
  "elma-esteri": [
    439,
    1057
  ],
  "tereyagi-diasetili": [
    893,
    995,
    1046
  ],
  "peynir-butirigi": [
    86,
    243,
    913
  ],
  "yogurt-laktonu": [
    20,
    218,
    974
  ],
  "dumanli-guaiakol": [
    649,
    1104
  ],
  "vanilin": [
    423
  ],
  "tarcin-aldehiti": [
    956,
    1022
  ],
  "bal-fenilasetaldehiti": [
    734,
    737
  ],
  "kimyon-aldehiti": [
    759
  ],
  "corekotu-timokinonu": [
    1011,
    1012
  ],
  "cemen-sotolonu": [
    341
  ],
  "susam-tiyazolu": [
    533,
    904,
    960
  ],
  "zerdecal-turmeronu": [],
  "kisnis-aldehiti": [
    670,
    730,
    1007
  ],
  "kuruyemis-pirazini": [
    173,
    427,
    556
  ],
  "zeytin-fenolu": [
    243,
    645,
    1064
  ],
  "sarap-fermente": [
    671,
    750,
    788
  ]
};

/** Kaç ailenin gerçek bileşik karşılığı bulundu. */
export const FAMILY_RESOLUTION = {
  families: 54,
  resolved: 50,
  compounds: 106,
};
