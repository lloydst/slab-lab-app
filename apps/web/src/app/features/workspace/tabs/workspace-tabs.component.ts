import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PreviewComponent } from '../../preview/preview.component';
import { TemplatePreviewComponent } from '../../template-preview/template-preview.component';
import { WorkspaceDesignService } from '../services/workspace-design.service';
import { WorkspaceUiService } from '../services/workspace-ui.service';

@Component({
  selector: 'slab-workspace-tabs',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, PreviewComponent, TemplatePreviewComponent],
  templateUrl: './workspace-tabs.component.html',
  styleUrl: './workspace-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceTabsComponent {
  readonly design = inject(WorkspaceDesignService);
  readonly ui = inject(WorkspaceUiService);
}
