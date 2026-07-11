# Reference Set

This folder collects silhouette-first vessel references for image analysis and shape study.

## Local modern references

- `modern/bodil_manz_glace_ii.jpg`
  - Source: https://www.oxfordceramics.com/artworks/5718-bodil-manz-glace-ii-2023/
  - Notes: crisp cylindrical modern vessel with stepped base and geometric accents.

- `modern/akihiro_maeta_vase.jpg`
  - Source: https://www.atelierikiwa.com/en/products/vase-en-porcelaine-blanche-de-akihiro-maeta
  - Notes: slender white porcelain vase with a quiet faceted profile.

- `modern/gharyan_stoneware_vase.jpg`
  - Source: https://www.gharyan.com/products/gharyan-stoneware-vase
  - Notes: smooth rounded body, narrow neck, simple contemporary silhouette.

- `modern/ceola_vase_nomad.jpg`
  - Source: https://www.shopperefined.com/products/ceola-vase-5-x-10
  - Notes: warm-toned rounded bottle form with a narrow opening.

- `modern/goodies_ceramic_vase.jpg`
  - Source: https://goodies.la/collections/ceramic
  - Notes: matte off-white vase with an ovalized body and compact neck.

- `modern/faceted_vase_chesapeake.jpg`
  - Source: https://chesapeakeceramics.com/products/faceted-vase
  - Notes: faceted modern silhouette with visible planar breaks.

- `modern/organic_porcelain_pinup.jpg`
  - Source: https://www.pinupmagazine.org/articles/artist-sara-flynn-ceramicist
  - Notes: asymmetrical porcelain vessel with an organic body.

- `modern/organic_folded_ceramicsnow.jpg`
  - Source: https://www.ceramicsnow.org/exhibitions/galerie-carla-koch-celebrates-its-25th-anniversary-with-an-exhibition/
  - Notes: folded, draped form with a more open rim profile.

- `modern/angular_slant_1stdibs.jpg`
  - Source: https://www.1stdibs.com/furniture/decorative-objects/vases-vessels/vases/white-angular-slant-vase-limited-edition-denmark-2021/id-f_33760632/
  - Notes: angular faceted vessel with a slanted body.

- `modern/organic_vessel_1stdibs.jpg`
  - Source: https://www.1stdibs.com/furniture/decorative-objects/vases-vessels/vases/ceramic-soda-fired-organic-shaped-vessel-vase/id-f_33122382/
  - Notes: hand-built organic vessel with a flared rim.

- `modern/primary_pitcher.jpg`
  - Source: https://traceaesthetic.myshopify.com/products/primary-pitcher
  - Notes: pitcher form with a visible spout and shoulder break.

- `modern/mesa_tray.jpg`
  - Source: https://lostine.com/products/mesa-ceramic-tray
  - Notes: shallow slab-friendly tray.

- `modern/slab_box.webp`
  - Source: https://clayelle.com/blog/clay-container-with-lid-ideas/
  - Notes: square lidded box shape.

- `modern/lidded_pot.jpg`
  - Source: https://www.wakaartisans.com/product-page/lidded-pot-by-mutsumi-ohashi
  - Notes: compact lidded pot with a rounded body.

- `modern/bowl_rother.jpg`
  - Source: https://www.ceramicsnow.org/artists/ines-rother/
  - Notes: low-profile bowl form.

- `modern/shallow_dish.jpg`
  - Source: https://benna.com.au/collections/bowls-dishes-and-platters
  - Notes: shallow dish / platter silhouette.

## Historic web references

- https://www.culturalconfluencewoodfiresymposium.com/giltaro-jardineiro
- https://www.clevelandart.org/print/art/2022.223
- https://www.metmuseum.org/art/collection/search/325429
- https://www.britishmuseum.org/collection/object/G_1897-0401-1021
- https://www.cincinnatiartmuseum.org/art/explore-the-collection?id=19975336&title=Vase

## Usage

Use these files as reference inputs for:

- `python -m slablab analyze-image --image ./references/modern/akihiro_maeta_vase.jpg --out ./outputs`
- `python -m slablab analyze-image --image ./references/modern/faceted_vase_chesapeake.jpg --out ./outputs`
- `python -m slablab analyze-image --image ./references/modern/angular_slant_1stdibs.jpg --out ./outputs`
- `python -m slablab analyze-image --image ./references/modern/mesa_tray.jpg --out ./outputs`
- `python -m slablab analyze-image --image ./references/modern/slab_box.webp --out ./outputs`

The local images are intended for development and testing. The linked pages are source references for the silhouettes and proportions.
