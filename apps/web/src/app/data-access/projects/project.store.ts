import { Injectable, computed, signal } from '@angular/core';
import { SlabProject, ShapeKind } from '@slablab/shared';
import { shapeDefaults } from '@slablab/geometry-engine';
import { LocalProjectRepository } from './local-project.repository';
import { ProjectRepository } from './project.repository';
import { parametersToMillimetres } from './project-units';

@Injectable({ providedIn: 'root' })
export class ProjectStore {
  private readonly repository: ProjectRepository;
  readonly projects = signal<SlabProject[]>([]);
  readonly activeId = signal<string | null>(null);
  readonly active = computed(() => this.projects().find((p) => p.id === this.activeId()) ?? null);

  constructor(local: LocalProjectRepository) {
    this.repository = local;
    let migrated = false;
    const stored = this.repository.load().map((project): SlabProject => {
      const shape: ShapeKind =
        (project.shape as string) === 'tapered-cylinder' ? 'truncated-cone' : project.shape;
      const canonical = project.parametersInMillimetres === true;
      migrated ||= !canonical;
      return {
        ...project,
        shape,
        parameters: {
          ...shapeDefaults[shape],
          ...(canonical
            ? project.parameters
            : parametersToMillimetres(project.parameters, project.unit)),
        },
        parametersInMillimetres: true,
      };
    });
    this.projects.set(stored);
    if (migrated) this.persist();
    if (stored.length) this.activeId.set(stored[0].id);
    else this.create('Cylinder study', 'cylinder');
  }

  create(name = 'Untitled vessel', shape: ShapeKind = 'cylinder') {
    const now = new Date().toISOString();
    const project: SlabProject = {
      id: crypto.randomUUID(),
      name,
      shape,
      parameters: { ...shapeDefaults[shape] },
      shrinkage: 0,
      unit: 'mm',
      parametersInMillimetres: true,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.update((all) => [project, ...all]);
    this.activeId.set(project.id);
    this.persist();
  }

  update(patch: Partial<SlabProject>) {
    const id = this.activeId();
    if (!id) return;
    this.projects.update((all) =>
      all.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)),
    );
    this.persist();
  }

  setShape(shape: ShapeKind) {
    this.update({ shape, parameters: { ...shapeDefaults[shape] } });
  }

  duplicate(id: string) {
    const source = this.projects().find((p) => p.id === id);
    if (!source) return;
    const now = new Date().toISOString();
    const copy = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} copy`,
      parameters: { ...source.parameters },
      createdAt: now,
      updatedAt: now,
    };
    this.projects.update((all) => [copy, ...all]);
    this.activeId.set(copy.id);
    this.persist();
  }

  delete(id: string) {
    this.projects.update((all) => all.filter((p) => p.id !== id));
    if (this.activeId() === id) this.activeId.set(this.projects()[0]?.id ?? null);
    if (!this.projects().length) this.create();
    else this.persist();
  }

  private persist() {
    this.repository.save(this.projects());
  }
}
