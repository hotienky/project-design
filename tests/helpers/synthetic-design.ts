/** A large design for performance checks: `services` × (1 service + 2 layers + 14 modules each). */
export function syntheticDesign(services = 10) {
  const nodes: Record<string, unknown>[] = [];
  const edges: Record<string, unknown>[] = [];
  for (let s = 0; s < services; s++) {
    const svc = `svc_${s}`;
    nodes.push({
      id: svc,
      kind: "service",
      name: `Service ${s}`,
      position: { x: (s % 5) * 1000, y: Math.floor(s / 5) * 900 },
      size: { width: 900, height: 800 },
      data: { language: "TypeScript", path: `apps/s${s}` },
    });
    for (let l = 0; l < 2; l++) {
      const layer = `lyr_${s}_${l}`;
      nodes.push({
        id: layer,
        kind: "layer",
        name: `Layer ${l}`,
        parentId: svc,
        position: { x: 20, y: 40 + l * 380 },
        size: { width: 860, height: 340 },
      });
      for (let m = 0; m < 14; m++) {
        const id = `mod_${s}_${l}_${m}`;
        nodes.push({
          id,
          kind: "module",
          name: `Module ${s}.${l}.${m}`,
          parentId: layer,
          position: { x: 20 + (m % 4) * 210, y: 40 + Math.floor(m / 4) * 70 },
        });
        if (m > 0) {
          edges.push({
            id: `e_${s}_${l}_${m}`,
            kind: "depends_on",
            source: id,
            target: `mod_${s}_${l}_${m - 1}`,
          });
        }
      }
    }
  }
  return { schemaVersion: 1, nodes, edges };
}
