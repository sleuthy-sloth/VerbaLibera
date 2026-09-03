# Image provenance — picture-choice vocab (all 8 patterns)

Every image under `public/images/vocab/` is CC0 or public domain (no
attribution required) sourced from Wikimedia Commons. License verified per
file page before download. Files were verified visually (each clearly
depicts its word), resized to max 800px (`sips -Z 800`), and served from
the app's own `public/` dir — no hotlinking. The SW caches `/images/**`
like `/audio/**`.

Rejected during visual review (not shipped): a train-interior shot
mislabeled as a station, a too-dark bar photo for shopkeeper, and the
Greenwich Hospital building (ambiguous — replaced by Hakodate Red Cross
Hospital with its rooftop cross).

| file | depicts | source | license | sha256 |
| ---- | ------- | ------ | ------- | ------ |
| `coffee.jpg` | white cup of black coffee on a wooden table | `File:Cup Coffee.jpg` | CC0 | `09e2de3303e1324d97d386a63f336263a2aef4ada207f89a383cd9c722648192` |
| `tea.jpg` | two steel cups of milky chai, top-down | `File:Cup of tea image.jpg` | CC0 | `b2936d849a8a5b1f0db7612f02501fbc8f8f8fcd39bf5dbbcbff7634af82809c` |
| `table.jpg` | set café tables in a restaurant interior | `File:Empty cozy café (Unsplash).jpg` | CC0 | `be9cd1f3ab19aa626dd0ef68c12186735accee16cfae4bdd03ae20080f46e9f0` |
| `bill.jpg` | itemized restaurant receipt with total | `File:HK SYP … bill receipt January 2026 N13P 02.jpg` | CC0 | `18cb31c12fa0ff5d4f917ecb5c5183c237807a4156457ea95a56c2c392eb9db1` |
| `shopkeeper.jpg` | market vendor at his stall with goods | `File:Elderly street vendor (Unsplash).jpg` | CC0 | `cc6a1b0540783cb5310b16df1ef809950615f483e3edbe35ba066a510f37f1a2` |
| `door.jpg` | wooden door close-up with handles | `File:Wooden door (Unsplash).jpg` | CC0 | `538f36b2bfe8aeaab5ee5e7bd40f608294373755febd6112c99611d7cbea53af` |
| `station.jpg` | Taipei Station hall with station signage | `File:Taipei Railway station interior (Unsplash).jpg` | CC0 | `df6a6a0a66e43ec2c89f0870a3941a67fc0ed0ef162a936f68fc2394da0d2de6` |
| `museum.jpg` | grand museum palace building | `File:AfricaMuseum in Tervuren (Belgium).jpg` | CC0 | `6a41c020f22d3c7021417e1b7a8ff6a05324f438eed4f2bf8b432c517c03064b` |
| `street.jpg` | quaint cobblestone city street | `File:Quaint City Streets (Unsplash).jpg` | CC0 | `4dcc6bbabb74511798a84ef201986c5e6a6d14f4b1c29c2c68568b77b986d9db` |
| `map.jpg` | map with colorful push-pins | `File:Map with colorful pins (Unsplash).jpg` | CC0 | `05042861c06d61f85d70bdd81033330641b4b70ff0678409fbdb654d00b6c0de` |
| `phone.jpg` | hand holding a smartphone | `File:Black smartphone in hand (Unsplash).jpg` | CC0 | `c352e46e9a3555db14fbb7e0a2942cbaf38716d3b0c85048a43cefc7bb5a6bac` |
| `passport.jpg` | Canadian passport on a desk | `File:Passport documents desk (Unsplash).jpg` | CC0 | `2816d49c4cd8cd32b7b876ac22e398a64438c82d7d5bb0c54b772683c9476427` |
| `card.jpg` | bank card in a payment terminal | `File:Card Payment (176811287).jpeg` | CC0 | `2db27853236640e8a69e0a661e9f3abb72264765d9f1e7590eaecc302b77733b` |
| `piggybank.jpg` | pink piggy bank on white | `File:Cute piggy bank (Unsplash).jpg` | CC0 | `982917ba8c7563ae0c1b90bafba818de68cf3128` |
| `wallet.jpg` | quilted purse held by a woman | `File:Checking Her Purse (Unsplash).jpg` | CC0 | `05dad81edc77f8a73a17b9b3bd9772f2f002cbffa28e28faa44b91c23b5d7b31` |
| `hotel.jpg` | turquoise hotel building with palms | `File:Blue hotel building (Unsplash).jpg` | CC0 | `32289b712d4fe093f529c25f345cc40a57e6f53998cdfd57686cc3afef326016` |
| `key.jpg` | key on a chain | `File:Engraved key on a branch (Unsplash).jpg` | CC0 | `a2f6d35a32674b7afd112369fb7de08cba8df266e0818650885169872a1ace91` |
| `bed.jpg` | breakfast tray on a hotel bed | `File:Breakfast in bed (Unsplash).jpg` | CC0 | `f03e1a58a3dfbf012b2f995d19bf4f660437e9163f17aa12b476abacc4b7c5b9` |
| `suitcase.jpg` | red suitcase in Tokyo station | `File:Suitcase in train station (Unsplash).jpg` | CC0 | `73000739e879220f0bf5682e1474680d441e7832831f1d82d45aba04d93995ce` |
| `ambulance.jpg` | white ambulance van with red cross | `File:Ambulance in Saigon near district 4 hospital.jpg` | CC0 | `b3b93edc5bae6138929b9401418610c11db0ad9319549fe51ac88f0eb652757d` |
| `police.jpg` | police cruiser with light bar | `File:White police car patrolling (Unsplash).jpg` | CC0 | `30ae5cc78d3c960495bee87329ce7eeed7e4c21174407fd86a00e453eb0c8213` |
| `hospital.jpg` | hospital building with rooftop red cross | `File:Hakodate Red Cross Hospital.JPG` | Public domain | `4543ca1890a170e7291908a8a1c17d2c755e336791853e73557c36f2e7aaa990` |

Source pages: `https://commons.wikimedia.org/wiki/<File:name>` for each
title above. If a source file's license ever changes upstream, replace the
image — the CC0 / public-domain status at time of download is recorded here.

Re-verify hashes any time with:
`shasum -a 256 public/images/vocab/*.jpg`
