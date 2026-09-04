/**
 * Vercel Serverless Function — /api/analyze-plan
 * Receives a floor plan file (PDF or image), converts it to base64,
 * sends it to the Claude API, and returns a structured JSON array of items.
 */

import Anthropic from '@anthropic-ai/sdk'
import { IncomingForm } from 'formidable'
import fs from 'fs'
import path from 'path'

export const config = { api: { bodyParser: false } }

const CLAUDE_PROMPT = `You are a furniture measurement assistant for a custom woodwork company in Panama.
Analyze this architectural floor plan and identify all custom furniture or built-in millwork elements (closets, kitchens, TV units, beds, wall paneling, wardrobes, nightstands, etc.).
For each element return a JSON array with these fields:
- "item": furniture type in Spanish (e.g. "Closet", "Mueble de TV", "Cocina", "Revestimiento", "Cama")
- "description": brief description of the piece
- "width_m": width in meters (null if unknown)
- "height_m": height in meters (null if unknown)
- "depth_m": depth in meters (null if unknown)
- "m2": calculated surface area (width × height), null if dimensions unavailable
- "confidence": "HIGH" if dimensions are explicitly written, "MEDIUM" if inferred, "LOW" if estimated
- "notes": any caveats or observations

Return ONLY a valid JSON array. No preamble, no explanation, no markdown formatting.`

/** Convert PDF first page to JPEG using sharp (if available) or return raw bytes */
async function toImageBytes(filePath, mimeType) {
  if (mimeType === 'application/pdf') {
    // Attempt pdf-to-image conversion via canvas / sharp
    // For Vercel, use @vercel/og or a lightweight approach
    // Fallback: send PDF bytes directly (Claude supports PDF natively)
    const bytes = fs.readFileSync(filePath)
    return { data: bytes.toString('base64'), mediaType: 'application/pdf' }
  }
  const bytes = fs.readFileSync(filePath)
  return { data: bytes.toString('base64'), mediaType: mimeType }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  // Parse multipart form
  const form = new IncomingForm({ maxFileSize: 10 * 1024 * 1024 })
  let file
  try {
    const [, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve([fields, files])
      })
    })
    file = Array.isArray(files.file) ? files.file[0] : files.file
    if (!file) throw new Error('No file received')
  } catch (err) {
    return res.status(400).json({ error: 'Invalid file upload: ' + err.message })
  }

  try {
    const mimeType = file.mimetype || 'image/jpeg'
    const { data: base64, mediaType } = await toImageBytes(file.filepath, mimeType)

    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: CLAUDE_PROMPT,
            },
          ],
        },
      ],
    })

    const raw = message.content[0]?.text?.trim() || '[]'
    let items
    try {
      items = JSON.parse(raw)
    } catch {
      // Try to extract JSON from the response
      const match = raw.match(/\[[\s\S]*\]/)
      items = match ? JSON.parse(match[0]) : []
    }

    return res.status(200).json(items)
  } catch (err) {
    console.error('analyze-plan error:', err)
    return res.status(500).json({ error: err.message || 'Analysis failed' })
  } finally {
    // Clean up temp file
    try { if (file?.filepath) fs.unlinkSync(file.filepath) } catch {}
  }
}
