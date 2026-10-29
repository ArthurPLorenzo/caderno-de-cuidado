import { h, setKids } from "../util.js";

export function render(box) {
  setKids(box, h("section", { class: "panel" }, h("h2", {}, "Em construção")));
}
