import { ComponentHarness } from '@angular/cdk/testing';

export class WorkspaceSidebarHarness extends ComponentHarness {
  static hostSelector = 'slab-workspace-sidebar';

  private readonly railActions = this.locatorForAll('.rail-action');

  async clickRailAction(label: string): Promise<void> {
    const actions = await this.railActions();
    for (const action of actions) {
      if ((await action.text()).includes(label)) {
        await action.click();
        return;
      }
    }
    throw new Error(`Could not find sidebar action "${label}".`);
  }
}
