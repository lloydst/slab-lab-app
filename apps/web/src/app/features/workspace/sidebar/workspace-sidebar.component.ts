import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ProjectStore } from '../../../data-access/projects/project.store';
import { WorkspaceUiService } from '../services/workspace-ui.service';

@Component({
  selector: 'slab-workspace-sidebar',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './workspace-sidebar.component.html',
  styleUrl: './workspace-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceSidebarComponent {
  readonly store = inject(ProjectStore);
  readonly ui = inject(WorkspaceUiService);

  createProject(): void {
    this.store.create();
    this.ui.openPanel('shape');
  }
}
