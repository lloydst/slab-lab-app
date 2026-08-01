# SlabLab architecture

SlabLab is a workspace monorepo with dependencies flowing inward toward framework-free domain code.

```text
Angular UI ──> Geometry engine <── future AI / reconstruction adapters
    │                │
    ├──> Exporters <─┘
    └──> Project repository interface ──> local storage / future API

NestJS API ──> future application services and persistent repositories
```

`@slablab/geometry-engine` owns shape validation, measurements, meshes, and flat patterns. It has no browser or Angular dependencies. Shapes implement a stable `Shape` contract and are created through `ShapeFactory`. Adding a shape requires a new implementation and one factory registration.

`@slablab/exporters` converts the neutral `SlabTemplate` representation to SVG, PDF, or 300-DPI PNG. SVG paths retain millimetre coordinates and physical page dimensions.

The Angular application uses signals for state and derived geometry. Geometry is recalculated only when project inputs change. Three.js receives neutral mesh buffers. `ProjectRepository` isolates persistence; the MVP adapter uses local storage.

The NestJS API currently provides a production health boundary. Future collaborative persistence, AI analysis, uploads, and reconstruction jobs belong behind application ports here—not in the geometry engine.

## Extension points

- Add shrinkage profiles and clay intelligence as injected compensation policies.
- Add tabs/notches and scoring as template post-processors.
- Add OBJ/STL adapters from `MeshData` without changing shapes.
- Add image analysis as an API adapter returning a shape proposal.
- Add custom curves and boolean operations as new geometry strategies.
