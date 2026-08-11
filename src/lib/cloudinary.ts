import { v2 as cloudinary } from "cloudinary";

// Render's free web services have no persistent disk - anything written to
// local disk is wiped on every restart/redeploy, which happens often on the
// free tier. Cloudinary gives us permanent storage without needing a paid
// Render plan. Falls back to local disk (in the upload route) when these
// env vars aren't set, so local dev and the Electron app don't need an
// account at all.
export function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
}

export function getCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}
