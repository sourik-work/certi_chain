/**
 * CertiChain Figma Plugin Main Logic
 * 1. Imports SVG template into current Figma page with named text layers (field:<key>)
 * 2. Exports selected frame back to CertiChain Studio
 */

figma.showUI(__html__, { width: 360, height: 420 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'import-template-svg') {
    try {
      const node = figma.createNodeFromSvg(msg.svgContent);
      node.name = msg.title || 'CertiChain Certificate Template';
      figma.currentPage.appendChild(node);
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
      figma.ui.postMessage({ type: 'import-success', name: node.name });
    } catch (err: any) {
      figma.ui.postMessage({ type: 'error', message: err.message || 'Failed to import SVG into Figma.' });
    }
  }

  if (msg.type === 'export-selected-frame') {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.ui.postMessage({ type: 'error', message: 'Please select a frame to export.' });
      return;
    }

    const targetNode = selection[0];
    try {
      const bytes = await targetNode.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: 2 },
      });

      // Extract field:<key> layer bounding boxes
      const fieldLayers: Array<{ key: string; bbox: { x: number; y: number; w: number; h: number } }> = [];
      const frameW = targetNode.width;
      const frameH = targetNode.height;

      function findFieldNodes(node: any) {
        if (node.name && node.name.startsWith('field:')) {
          const key = node.name.replace('field:', '').trim();
          fieldLayers.push({
            key,
            bbox: {
              x: node.x / frameW,
              y: node.y / frameH,
              w: node.width / frameW,
              h: node.height / frameH,
            },
          });
        }
        if ('children' in node) {
          for (const child of node.children) {
            findFieldNodes(child);
          }
        }
      }

      findFieldNodes(targetNode);

      figma.ui.postMessage({
        type: 'export-success',
        pngBytes: Array.from(bytes),
        fieldLayers,
      });
    } catch (err: any) {
      figma.ui.postMessage({ type: 'error', message: err.message || 'Failed to export frame.' });
    }
  }
};
