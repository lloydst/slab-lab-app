import { Injectable } from '@angular/core';
import type { SlabProject } from '@slablab/shared';
import { ProjectRepository } from './project.repository';

@Injectable({ providedIn: 'root' })
export class LocalProjectRepository implements ProjectRepository {
  private readonly key = 'slablab.projects.v1';

  load(): SlabProject[] {
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? '[]') as SlabProject[];
    } catch {
      return [];
    }
  }

  save(projects: SlabProject[]) {
    localStorage.setItem(this.key, JSON.stringify(projects));
  }
}
