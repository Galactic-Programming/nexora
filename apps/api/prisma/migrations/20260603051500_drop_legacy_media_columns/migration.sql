-- Legacy media columns superseded by the polymorphic `media_assets` table
-- (Cloudinary migration, Phase 4). See docs/planning/cloudinary-media-migration.md.

-- DropColumn
ALTER TABLE "destinations" DROP COLUMN "hero_image";

-- DropColumn
ALTER TABLE "tours" DROP COLUMN "gallery",
DROP COLUMN "hero_image";
