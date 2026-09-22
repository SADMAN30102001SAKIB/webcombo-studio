import { Container } from "@cloudflare/containers";

export class WebComboContainer extends Container {
  defaultPort = 3000;
}

export default {
  async fetch(request, env) {
    const id = env.WEBCOMBO.idFromName("primary");
    const container = env.WEBCOMBO.get(id);
    return container.fetch(request);
  },
};
