# Image provenance — picture-choice vocab pilot

Every image under `public/images/vocab/` is CC0 (public domain dedication,
no attribution required) sourced from Wikimedia Commons. Files were
downloaded at full resolution, verified visually, and resized to max 800px
(`sips -Z 800`) for the offline-first PWA bundle. No hotlinking: the app
serves these from its own `public/` dir and the SW caches `/images/**`
like `/audio/**`.

| file | depicts | source | license | sha256 |
| ---- | ------- | ------ | ------- | ------ |
| `coffee.jpg` | white cup of black coffee on a wooden table | `File:Cup Coffee.jpg` | CC0 | `09e2de3303e1324d97d386a63f336263a2aef4ada207f89a383cd9c722648192` |
| `tea.jpg` | two steel cups of milky chai, top-down | `File:Cup of tea image.jpg` | CC0 | `b2936d849a8a5b1f0db7612f02501fbc8f8f8fcd39bf5dbbcbff7634af82809c` |
| `table.jpg` | set café tables in a restaurant interior | `File:Empty cozy café (Unsplash).jpg` | CC0 | `be9cd1f3ab19aa626dd0ef68c12186735accee16cfae4bdd03ae20080f46e9f0` |
| `bill.jpg` | itemized restaurant receipt with total | `File:HK SYP … bill receipt January 2026 N13P 02.jpg` | CC0 | `18cb31c12fa0ff5d4f917ecb5c5183c237807a4156457ea95a56c2c392eb9db1` |

Source pages: `https://commons.wikimedia.org/wiki/<File:name>` for each
title above. License verified per file page (`LicenseShortName = CC0`)
before download. If a source file's license ever changes upstream, replace
the image — the CC0 dedication at time of download is recorded here.

Re-verify hashes any time with:
`shasum -a 256 public/images/vocab/*.jpg`
