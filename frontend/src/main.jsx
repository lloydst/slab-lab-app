import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const FAMILIES = [
  'polygon_prism',
  'tapered_polygon',
  'round_frustum',
  'scallop_frustum',
  'oval_cylinder',
  'faceted_star',
  'slab_box',
  'slab_tray',
  'round_lid',
  'polygon_lid',
  'oval_lid',
]

const ASSEMBLY_FAMILIES = [
  'polygon_prism',
  'tapered_polygon',
  'round_frustum',
  'scallop_frustum',
  'oval_cylinder',
  'faceted_star',
  'slab_box',
  'slab_tray',
  'round_lid',
  'polygon_lid',
  'oval_lid',
]

const ICONS = {
  spark: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2zM5 14l1 2.8L9 18l-2.8 1-1 2.8-1-2.8L1.4 18l2.8-1L5 14zm14-2 .8 2.2L22 15l-2.2.8-.8 2.2-.8-2.2L16 15l2.2-.8.8-2.2z" fill="currentColor"/></svg>
  ),
  upload: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l4 4h-3v7h-2V7H8l4-4zm-7 14h14v2H5v-2z" fill="currentColor"/></svg>
  ),
  play: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
  ),
  download: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10m0 0 4-4m-4 4-4-4M5 19h14v2H5z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  file: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l4 4v16H6z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M14 2v6h6" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
  ),
}

function App() {
  const [prompt, setPrompt] = useState('A straight hexagonal cup with six equal sides and a clean geometric base.')
  const [description, setDescription] = useState(prompt)
  const [spec, setSpec] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [job, setJob] = useState(null)
  const [svg, setSvg] = useState('')
  const [obj, setObj] = useState('')
  const [meshSpans, setMeshSpans] = useState([])
  const [meshVertexSpans, setMeshVertexSpans] = useState([])
  const [validation, setValidation] = useState(null)
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [selectedImageName, setSelectedImageName] = useState('')
  const [previewOpacity, setPreviewOpacity] = useState(0.72)
  const fileRef = useRef(null)
  const previewRequestRef = useRef(0)
  const previewReadyRef = useRef(false)

  const api = useMemo(() => API_BASE.replace(/\/$/, ''), [])

  async function fetchJSON(path, options) {
    const response = await fetch(`${api}${path}`, options)
    if (!response.ok) {
      throw new Error(await response.text())
    }
    return response.json()
  }

  function handleImageSelection(event) {
    const file = event.target.files?.[0]
    if (!file) {
      setSelectedImageName('')
      setSelectedImageUrl('')
      return
    }
    setSelectedImageName(file.name)
    setSelectedImageUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })
  }

  async function analyzeImage() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const response = await fetch(`${api}/api/analyze-image`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Filename': file.name,
        },
        body: file,
      })
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json()
      setAnalysis(data.analysis)
      setDescription(data.description)
      const specData = await fetchJSON('/api/spec-from-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: data.description }),
      })
      setSpec(specData)
    } finally {
      setBusy(false)
    }
  }

  async function parseDescription() {
    setBusy(true)
    try {
      const specData = await fetchJSON('/api/spec-from-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: prompt }),
      })
      setDescription(prompt)
      setSpec(specData)
    } finally {
      setBusy(false)
    }
  }

  async function generate() {
    if (!spec) return
    return generateFromSpec(spec)
  }

  async function generateFromSpec(nextSpec) {
    if (!nextSpec) return
    const requestId = ++previewRequestRef.current
    setBusy(true)
    try {
      const result = await fetchJSON('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSpec),
      })
      if (requestId !== previewRequestRef.current) return
      setJob(result.job_id)
      setValidation(result.validation)
      setFiles(result.files || [])
      const svgText = result.preview_svg || ''
      const objText = result.preview_obj || ''
      const spanText = result.mesh_spans || []
      const vertexSpanText = result.mesh_vertex_spans || []
      if (requestId !== previewRequestRef.current) return
      setSvg(svgText)
      setObj(objText)
      setMeshSpans(spanText)
      setMeshVertexSpans(vertexSpanText)
      previewReadyRef.current = true
    } finally {
      if (requestId === previewRequestRef.current) {
        setBusy(false)
      }
    }
  }

  async function updateJob() {
    if (!job) return
    const data = await fetchJSON(`/api/jobs/${job}`)
    setValidation(data.validation)
    setFiles(data.files || [])
  }

  function updateSpecField(field, value) {
    setSpec((current) => ({ ...(current || {}), [field]: value }))
  }

  function parseMaybeNumber(value) {
    return value === '' ? null : Number(value)
  }

  function deriveAssemblySummary(current) {
    if (!current?.assembly_parts?.length) return current
    const parts = current.assembly_parts
    const primary = parts.find((part) => /body|main|vessel|pot/i.test(part.name || '')) || parts[0]
    const height_mm = Math.max(...parts.map((part) => (part.offset_z_mm ?? 0) + (part.height_mm ?? 0)))
    const top_diameter_mm = Math.max(...parts.map((part) => part.top_diameter_mm ?? 0))
    return {
      ...current,
      family: primary.family || current.family,
      height_mm,
      bottom_diameter_mm: primary.bottom_diameter_mm ?? current.bottom_diameter_mm,
      top_diameter_mm,
      sides: primary.sides ?? current.sides ?? null,
      scallops: primary.scallops ?? current.scallops ?? null,
      scallop_depth_mm: primary.scallop_depth_mm ?? current.scallop_depth_mm ?? null,
      oval_major_mm: primary.oval_major_mm ?? current.oval_major_mm ?? null,
      oval_minor_mm: primary.oval_minor_mm ?? current.oval_minor_mm ?? null,
      facets: primary.facets ?? current.facets ?? null,
      ripple_mm: primary.ripple_mm ?? current.ripple_mm ?? null,
    }
  }

  function updateAssemblyPart(index, field, value) {
    setSpec((current) => {
      if (!current?.assembly_parts?.length) return current
      const assembly_parts = current.assembly_parts.map((part, partIndex) =>
        partIndex === index ? { ...part, [field]: value } : part,
      )
      return deriveAssemblySummary({ ...current, assembly_parts })
    })
  }

  function addAssemblyPart() {
    setSpec((current) => {
      const assembly_parts = current?.assembly_parts ? [...current.assembly_parts] : []
      const hasBody = assembly_parts.some((part) => /body|main|vessel|pot/i.test(part.name || ''))
      assembly_parts.push({
        name: assembly_parts.length === 0 || !hasBody ? 'body' : `part_${assembly_parts.length + 1}`,
        family: assembly_parts.length === 0 || !hasBody ? 'round_frustum' : 'round_lid',
        height_mm: assembly_parts.length === 0 || !hasBody ? 120 : 12,
        bottom_diameter_mm: assembly_parts.length === 0 || !hasBody ? 72 : 40,
        top_diameter_mm: assembly_parts.length === 0 || !hasBody ? 96 : 40,
        offset_x_mm: 0,
        offset_y_mm: 0,
        offset_z_mm: 0,
        notes: [],
      })
      return deriveAssemblySummary({ ...(current || {}), assembly_parts })
    })
  }

  function removeAssemblyPart(index) {
    setSpec((current) => {
      if (!current?.assembly_parts?.length) return current
      const assembly_parts = current.assembly_parts.filter((_, partIndex) => partIndex !== index)
      return deriveAssemblySummary({ ...current, assembly_parts })
    })
  }

  useEffect(() => {
    if (!spec) return undefined
    if (!previewReadyRef.current) return undefined
    const timeout = window.setTimeout(() => {
      generateFromSpec(spec)
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [spec])

  useEffect(() => {
    return () => {
      if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl)
    }
  }, [selectedImageUrl])

  const warnings = [
    ...(analysis?.warnings || []),
    ...(validation?.warnings || []),
    ...(spec?.warnings || []),
  ]

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Slab Lab App</div>
          <h1>Vessel spec to slab template pipeline</h1>
        </div>
        <div className="top-actions">
          <button className="button" onClick={parseDescription} disabled={busy}>
            <ICONS.spark /> Parse description
          </button>
          <button className="button primary" onClick={generate} disabled={busy || !spec}>
            <ICONS.play /> Generate
          </button>
        </div>
      </header>

      <section className="control-band">
        <div className="control-row">
          <label className="field">
            <span>Text prompt</span>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
          </label>
          <label className="field">
            <span>Reference image</span>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageSelection} />
            {selectedImageUrl && (
              <div className="upload-preview">
                <img src={selectedImageUrl} alt={selectedImageName} />
                <div className="upload-meta">
                  <div>{selectedImageName}</div>
                </div>
              </div>
            )}
            <button className="button" onClick={analyzeImage} disabled={busy}>
              <ICONS.upload /> Analyze image
            </button>
          </label>
        </div>
      </section>

      <main className="workspace">
        <section className="panel">
          <div className="panel-title">Description</div>
          <label className="field">
            <span>Generated shape description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={7} />
          </label>
          {analysis && (
            <div className="meta">
              <div>Detected family: {analysis.detected_family}</div>
              <div>Confidence: {Math.round(analysis.confidence * 100)}%</div>
              <div>Symmetry: {analysis.symmetry}</div>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-title">Vessel spec</div>
          {spec ? (
            <div className="spec-stack">
              <div className="spec-grid">
                <label className="field"><span>Name</span><input value={spec.name || ''} onChange={(e) => updateSpecField('name', e.target.value)} /></label>
                <label className="field"><span>Shrinkage %</span><input type="number" value={spec.shrinkage_percent ?? 0} onChange={(e) => updateSpecField('shrinkage_percent', Number(e.target.value))} /></label>
              </div>
              {spec.assembly_parts?.length ? (
                <div className="assembly-summary">
                  <div className="panel-subtitle">Derived vessel summary</div>
                  <div className="spec-grid">
                    <label className="field">
                      <span>Family</span>
                      <input value={spec.family || 'round_frustum'} readOnly />
                    </label>
                    <label className="field">
                      <span>Height mm</span>
                      <input value={spec.height_mm ?? ''} readOnly />
                    </label>
                    <label className="field">
                      <span>Bottom diameter mm</span>
                      <input value={spec.bottom_diameter_mm ?? ''} readOnly />
                    </label>
                    <label className="field">
                      <span>Top diameter mm</span>
                      <input value={spec.top_diameter_mm ?? ''} readOnly />
                    </label>
                    <div className="summary-note">
                      Assembly parts are the editable source of truth. The summary is derived from the body and attached parts.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="spec-grid">
                  <label className="field">
                    <span>Family</span>
                    <select value={spec.family || 'round_frustum'} onChange={(e) => updateSpecField('family', e.target.value)}>
                      {FAMILIES.map((family) => <option key={family} value={family}>{family}</option>)}
                    </select>
                  </label>
                  <label className="field"><span>Height mm</span><input type="number" value={spec.height_mm ?? ''} onChange={(e) => updateSpecField('height_mm', Number(e.target.value))} /></label>
                  <label className="field"><span>Bottom diameter mm</span><input type="number" value={spec.bottom_diameter_mm ?? ''} onChange={(e) => updateSpecField('bottom_diameter_mm', Number(e.target.value))} /></label>
                  <label className="field"><span>Top diameter mm</span><input type="number" value={spec.top_diameter_mm ?? ''} onChange={(e) => updateSpecField('top_diameter_mm', Number(e.target.value))} /></label>
                  <label className="field"><span>Sides</span><input type="number" value={spec.sides ?? ''} onChange={(e) => updateSpecField('sides', e.target.value === '' ? null : Number(e.target.value))} /></label>
                  <label className="field"><span>Scallops</span><input type="number" value={spec.scallops ?? ''} onChange={(e) => updateSpecField('scallops', e.target.value === '' ? null : Number(e.target.value))} /></label>
                  <label className="field"><span>Scallop depth mm</span><input type="number" value={spec.scallop_depth_mm ?? ''} onChange={(e) => updateSpecField('scallop_depth_mm', e.target.value === '' ? null : Number(e.target.value))} /></label>
                  <label className="field"><span>Oval major mm</span><input type="number" value={spec.oval_major_mm ?? ''} onChange={(e) => updateSpecField('oval_major_mm', e.target.value === '' ? null : Number(e.target.value))} /></label>
                  <label className="field"><span>Oval minor mm</span><input type="number" value={spec.oval_minor_mm ?? ''} onChange={(e) => updateSpecField('oval_minor_mm', e.target.value === '' ? null : Number(e.target.value))} /></label>
                  <label className="field"><span>Facets</span><input type="number" value={spec.facets ?? ''} onChange={(e) => updateSpecField('facets', e.target.value === '' ? null : Number(e.target.value))} /></label>
                  <label className="field"><span>Ripple mm</span><input type="number" value={spec.ripple_mm ?? ''} onChange={(e) => updateSpecField('ripple_mm', e.target.value === '' ? null : Number(e.target.value))} /></label>
                </div>
              )}
            </div>
          ) : (
            <div className="empty">Parse a description or analyze an image to populate the spec.</div>
          )}
          {spec ? (
            <div className="assembly-list">
              <div className="assembly-header">
                <div className="panel-subtitle">Assembly parts</div>
                <button className="button" type="button" onClick={addAssemblyPart}>Add part</button>
              </div>
              {spec.assembly_parts?.length ? (
                spec.assembly_parts.map((part, index) => (
                  <div key={`${part.name}-${index}`} className="assembly-row">
                    <div className="assembly-grid">
                      <label className="field compact">
                        <span>Name</span>
                        <input value={part.name || ''} onChange={(e) => updateAssemblyPart(index, 'name', e.target.value)} />
                      </label>
                      <label className="field compact">
                        <span>Family</span>
                        <select value={part.family || 'round_lid'} onChange={(e) => updateAssemblyPart(index, 'family', e.target.value)}>
                          {ASSEMBLY_FAMILIES.map((family) => <option key={family} value={family}>{family}</option>)}
                        </select>
                      </label>
                      <label className="field compact">
                        <span>Height</span>
                        <input type="number" value={part.height_mm ?? ''} onChange={(e) => updateAssemblyPart(index, 'height_mm', parseMaybeNumber(e.target.value))} />
                      </label>
                      <label className="field compact">
                        <span>Bottom</span>
                        <input type="number" value={part.bottom_diameter_mm ?? ''} onChange={(e) => updateAssemblyPart(index, 'bottom_diameter_mm', parseMaybeNumber(e.target.value))} />
                      </label>
                      <label className="field compact">
                        <span>Top</span>
                        <input type="number" value={part.top_diameter_mm ?? ''} onChange={(e) => updateAssemblyPart(index, 'top_diameter_mm', parseMaybeNumber(e.target.value))} />
                      </label>
                      <label className="field compact">
                        <span>dx</span>
                        <input type="number" value={part.offset_x_mm ?? 0} onChange={(e) => updateAssemblyPart(index, 'offset_x_mm', parseMaybeNumber(e.target.value) ?? 0)} />
                      </label>
                      <label className="field compact">
                        <span>dy</span>
                        <input type="number" value={part.offset_y_mm ?? 0} onChange={(e) => updateAssemblyPart(index, 'offset_y_mm', parseMaybeNumber(e.target.value) ?? 0)} />
                      </label>
                      <label className="field compact">
                        <span>dz</span>
                        <input type="number" value={part.offset_z_mm ?? 0} onChange={(e) => updateAssemblyPart(index, 'offset_z_mm', parseMaybeNumber(e.target.value) ?? 0)} />
                      </label>
                    </div>
                    <div className="assembly-actions">
                      <button className="button" type="button" onClick={() => removeAssemblyPart(index)}>Remove</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">No assembly parts yet. Add one for lids, finials, handles, or multi-piece forms.</div>
              )}
            </div>
          ) : null}
        </section>

        <section className="panel wide">
          <div className="panel-title">Template preview</div>
          <div className="svg-frame" dangerouslySetInnerHTML={{ __html: svg || '<div class="empty">No SVG generated yet.</div>' }} />
        </section>

        <section className="panel">
          <div className="panel-title">3D preview</div>
          <div className="preview-controls">
            <label className="field compact">
              <span>Opacity</span>
              <input
                type="range"
                min="0.12"
                max="1"
                step="0.01"
                value={previewOpacity}
                onChange={(e) => setPreviewOpacity(Number(e.target.value))}
              />
            </label>
            <div className="preview-value">{Math.round(previewOpacity * 100)}%</div>
          </div>
          <MeshPreview objText={obj} opacityScale={previewOpacity} meshSpans={meshSpans} meshVertexSpans={meshVertexSpans} />
        </section>

        <section className="panel">
          <div className="panel-title">Validation</div>
          {validation ? (
            <div className="validation">
              <div>Valid: {String(validation.valid)}</div>
              <div>Buildable: {String(validation.buildable)}</div>
              <div>Closure: {String(validation.closure_ok)}</div>
              <div>SVG units: {String(validation.svg_units_ok)}</div>
              <div>Approximate: {String(validation.approximate)}</div>
              <div>Base perimeter mm: {validation.base_perimeter_mm?.toFixed?.(2) ?? validation.base_perimeter_mm}</div>
              <div>Matched edges mm: {validation.matched_edges_mm?.toFixed?.(2) ?? validation.matched_edges_mm}</div>
            </div>
          ) : (
            <div className="empty">Validation will appear after generation.</div>
          )}
          {warnings.length > 0 && (
            <div className="warnings">
              {warnings.map((warning, index) => <div key={index} className="warning">{warning}</div>)}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-title">Downloads</div>
          <div className="download-list">
            {job && (
              <a className="button" href={`${api}/api/files/${job}?name=bundle.zip`}>
                <ICONS.download /> ZIP bundle
              </a>
            )}
            {files.filter((file) => file.name !== 'bundle.zip').map((file) => (
              <a key={file.name} className="link-row" href={`${api}/api/files/${job}?name=${encodeURIComponent(file.name)}`}>
                <ICONS.file /> {file.name}
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function MeshPreview({ objText, opacityScale = 0.72, meshSpans = [], meshVertexSpans = [] }) {
  const canvasRef = useRef(null)
  const rotationRef = useRef({ x: -0.25, y: 0.7 })
  const dragRef = useRef({ active: false, x: 0, y: 0 })
  const autoRotateRef = useRef(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let animationFrame = 0
    const mesh = parseOBJ(objText)
    const handlePointerDown = (event) => {
      dragRef.current.active = true
      autoRotateRef.current = false
      dragRef.current.x = event.clientX
      dragRef.current.y = event.clientY
      canvas.setPointerCapture?.(event.pointerId)
    }
    const handlePointerMove = (event) => {
      if (!dragRef.current.active) return
      const dx = event.clientX - dragRef.current.x
      const dy = event.clientY - dragRef.current.y
      dragRef.current.x = event.clientX
      dragRef.current.y = event.clientY
      rotationRef.current.y += dx * 0.01
      rotationRef.current.x = Math.max(-1.45, Math.min(1.2, rotationRef.current.x + dy * 0.01))
    }
    const handlePointerUp = (event) => {
      dragRef.current.active = false
      canvas.releasePointerCapture?.(event.pointerId)
    }
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerUp)
    const render = (time) => {
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.lineWidth = 1
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      if (mesh.vertices.length) {
        if (autoRotateRef.current && !dragRef.current.active) {
          rotationRef.current.y += 0.002
        }
        const { x: rotX, y: rotY } = rotationRef.current
        const projectedRaw = mesh.vertices.map(([x, y, z]) => project(x, y, z, rotX, rotY, width, height))
        const rawXs = projectedRaw.map(([x]) => x)
        const rawYs = projectedRaw.map(([, y]) => y)
        const minX = Math.min(...rawXs)
        const maxX = Math.max(...rawXs)
        const minY = Math.min(...rawYs)
        const maxY = Math.max(...rawYs)
        const bboxWidth = Math.max(maxX - minX, 1)
        const bboxHeight = Math.max(maxY - minY, 1)
        const totalHeight = Math.max(...mesh.vertices.map(([, , z]) => z)) - Math.min(...mesh.vertices.map(([, , z]) => z))
        const heightBias = Math.min(28, totalHeight * 0.06)
        const projected = projectedRaw.map(([x, y, depth]) => {
          const centeredX = x + (width - bboxWidth) / 2 - minX
          const centeredY = y + (height - bboxHeight) / 2 - minY + heightBias
          return [centeredX, centeredY, depth]
        })
        const partRanges = meshVertexSpans.map(([, start, count]) => ({
          minZ: Infinity,
          maxZ: -Infinity,
          start,
          end: start + count,
        }))
        mesh.vertices.forEach(([x, y, z], index) => {
          for (const range of partRanges) {
            if (index >= range.start && index < range.end) {
              range.minZ = Math.min(range.minZ, z)
              range.maxZ = Math.max(range.maxZ, z)
            }
          }
        })

        const faces = mesh.faces
          .map((face, faceIndex) => {
            const points = face.map((index) => projected[index - 1])
            if (points.some((point) => !point)) return null
            const depth = points.reduce((sum, point) => sum + point[2], 0) / points.length
            const partIndex = meshSpans.findIndex(([, start, count]) => faceIndex >= start && faceIndex < start + count)
            const partRange = partRanges[partIndex]
            const zValues = face.map((index) => mesh.vertices[index - 1][2])
            const zMin = Math.min(...zValues)
            const zMax = Math.max(...zValues)
            const cap = zMax - zMin < 0.001 ? 'flat' : 'side'
            let faceKind = 'side'
            if (cap === 'flat' && partRange) {
              const faceZ = zValues.reduce((sum, value) => sum + value, 0) / zValues.length
              const partMid = (partRange.minZ + partRange.maxZ) / 2
              faceKind = faceZ >= partMid ? 'top' : 'bottom'
            }
            return { points, depth, partIndex, faceKind }
          })
          .filter(Boolean)
          .sort((a, b) => b.depth - a.depth)

        const depthValues = faces.map((face) => face.depth)
        const minDepth = Math.min(...depthValues)
        const maxDepth = Math.max(...depthValues)
        const depthSpan = Math.max(maxDepth - minDepth, 1e-6)

        const partPalette = [
          [37, 99, 235],
          [14, 165, 233],
          [34, 197, 94],
          [245, 158, 11],
          [168, 85, 247],
          [239, 68, 68],
          [20, 184, 166],
          [234, 88, 12],
        ]

        for (const { points, depth, partIndex, faceKind } of faces) {
          const depthNorm = (depth - minDepth) / depthSpan
          const shade = Math.max(0.12, Math.min(0.92, (0.25 + (1 - depthNorm) * 0.55) * opacityScale))
          const [r, g, b] = partPalette[(partIndex >= 0 ? partIndex : 0) % partPalette.length]
          const fill = faceKind === 'top'
            ? `rgba(250, 204, 21, ${shade})`
            : faceKind === 'bottom'
              ? `rgba(15, 23, 42, ${shade})`
              : `rgba(${r}, ${g}, ${b}, ${shade})`
          ctx.beginPath()
          ctx.moveTo(points[0][0], points[0][1])
          for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
          ctx.closePath()
          ctx.fillStyle = fill
          ctx.fill()
          ctx.strokeStyle = `rgba(15, 23, 42, ${Math.min(0.85, shade + 0.12)})`
          ctx.stroke()
        }
      } else {
        ctx.fillStyle = '#64748b'
        ctx.fillText('No mesh loaded yet.', 20, 32)
      }
      animationFrame = requestAnimationFrame(render)
    }
    animationFrame = requestAnimationFrame(render)
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerUp)
      cancelAnimationFrame(animationFrame)
    }
  }, [objText, opacityScale])

  return <canvas ref={canvasRef} className="mesh-canvas" width={520} height={360} />
}

function parseOBJ(text) {
  const vertices = []
  const faces = []
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/)
    if (parts[0] === 'v' && parts.length >= 4) {
      vertices.push(parts.slice(1, 4).map(Number))
    } else if (parts[0] === 'f' && parts.length >= 4) {
      faces.push(parts.slice(1, 4).map((value) => Number(value.split('/')[0])))
    }
  }
  return { vertices, faces }
}

function project(x, y, z, rotX, rotY, width, height) {
  const cosY = Math.cos(rotY)
  const sinY = Math.sin(rotY)
  const cosX = Math.cos(rotX)
  const sinX = Math.sin(rotX)

  const x1 = x * cosY - y * sinY
  const y1 = x * sinY + y * cosY
  const z1 = z

  const y2 = y1 * cosX - z1 * sinX
  const z2 = y1 * sinX + z1 * cosX

  const perspective = 640
  const depth = perspective / (perspective + y2 * 1.3)
  const scale = 1.15 * depth
  const px = width / 2 + x1 * scale
  const py = height / 2 - z2 * scale + 28
  return [px, py, y2]
}

createRoot(document.getElementById('root')).render(<App />)
