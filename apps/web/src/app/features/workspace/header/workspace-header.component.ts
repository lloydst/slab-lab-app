import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectStore } from '../../../data-access/projects/project.store';
import { WorkspaceUiService } from '../services/workspace-ui.service';

@Component({
  selector: 'slab-workspace-header',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatIconModule, MatSelectModule, MatTooltipModule],
  templateUrl: './workspace-header.component.html',
  styleUrl: './workspace-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceHeaderComponent {
  readonly exportDisabled = input(false);
  readonly exportRequested = output<void>();
  readonly store = inject(ProjectStore);
  readonly ui = inject(WorkspaceUiService);
}
