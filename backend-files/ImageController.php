<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Image;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ImageController extends Controller
{
    /**
     * GET /api/images
     * List all images (newest first).
     */
    public function index()
    {
        return Image::orderByDesc('created_at')->get();
    }

    /**
     * POST /api/images
     * Upload a single image.
     */
    public function store(Request $request)
    {
        $request->validate([
            'image' => 'required|image|max:10240', // max 10MB
        ]);

        $file = $request->file('image');
        $originalName = $file->getClientOriginalName();
        $size = $file->getSize();

        // Check for duplicates
        $existing = Image::where('original_name', $originalName)
                         ->where('size', $size)
                         ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Image already exists',
                'duplicate' => true,
                'image' => $existing
            ], 409);
        }

        $filename = time() . '_' . $file->hashName();
        $path = $file->storeAs('images', $filename, 'public');

        $image = Image::create([
            'filename'      => $filename,
            'original_name' => $originalName,
            'path'          => $path,
            'mime_type'     => $file->getMimeType(),
            'size'          => $size,
        ]);

        return response()->json($image, 201);
    }

    /**
     * GET /api/images/{image}/file
     * Serve the image file directly (no symlink needed).
     */
    public function serve(Image $image)
    {
        if (!Storage::disk('public')->exists($image->path)) {
            abort(404, 'Image not found');
        }

        $file = Storage::disk('public')->get($image->path);
        $mimeType = $image->mime_type ?? 'image/jpeg';

        return response($file, 200)
            ->header('Content-Type', $mimeType)
            ->header('Cache-Control', 'public, max-age=31536000');
    }

    /**
     * DELETE /api/images/{image}
     * Delete an image from storage and database.
     */
    public function destroy(Image $image)
    {
        if (Storage::disk('public')->exists($image->path)) {
            Storage::disk('public')->delete($image->path);
        }

        $image->delete();

        return response()->json(['message' => 'Image deleted'], 200);
    }
}
