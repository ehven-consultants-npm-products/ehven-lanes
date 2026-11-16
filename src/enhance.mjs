/** Optional horizontal placement for browsers without native cyclic Grid Lanes. */
const instances = new WeakMap();
const activeAttribute = 'data-ehven-lanes-enhanced';
const measuringAttribute = 'data-ehven-lanes-measuring';
const blockSizeProperty = '--ehven-lanes-block-size';
const itemProperties = ['--ehven-lanes-item-size', '--ehven-lanes-item-inline', '--ehven-lanes-item-block'];
const number = value => Number.parseFloat(value) || 0;
const snapshot = (element, properties) => ({ present: element.hasAttribute('style'),
  values: properties.map(name => [name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]) });
function set(element, name, value, priority = '') {
  if (element.style.getPropertyValue(name) !== value || element.style.getPropertyPriority(name) !== priority) {
    element.style.setProperty(name, value, priority);
  }
}
function restore(element, properties) {
  for (const [name, value, priority] of properties.values) {
    if (value) set(element, name, value, priority);
    else if (element.style.getPropertyValue(name)) element.style.removeProperty(name);
  }
  if (!properties.present && element.style.length === 0) element.removeAttribute('style');
}

/**
 * Enhance one .ehven-lanes container. Call destroy() when its owner unmounts it.
 * Repeated calls return the existing controller; its initial options apply.
 */
export function enhanceLanes(container, options = {}) {
  const view = container?.ownerDocument?.defaultView;
  if (!view || !(container instanceof view.HTMLElement) || !container.classList.contains('ehven-lanes')) {
    throw new TypeError('enhanceLanes requires an HTML .ehven-lanes container');
  }
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some(key => key !== 'force') ||
      options.force !== undefined && typeof options.force !== 'boolean') {
    throw new TypeError('Only the optional boolean force setting is supported');
  }
  if (instances.has(container)) return instances.get(container);
  if (container.hasAttribute(activeAttribute) || container.hasAttribute(measuringAttribute)) {
    throw new Error('The container already has enhancement-owned attributes');
  }
  const native = view.CSS?.supports('display', 'grid-lanes') &&
    (view.CSS.supports('fit-tolerance', 'infinite') || view.CSS.supports('flow-tolerance', 'infinite'));
  if (native && !options.force) {
    let ended = false;
    const controller = { refresh() {}, destroy() { if (!ended) { ended = true; instances.delete(container); } } };
    instances.set(container, controller);
    return controller;
  }
  if (!view.ResizeObserver || !view.MutationObserver || !view.requestAnimationFrame) {
    throw new Error('Horizontal enhancement requires ResizeObserver, MutationObserver and requestAnimationFrame');
  }

  const rootProperties = snapshot(container, [blockSizeProperty]);
  const items = new Map();
  const observed = new WeakMap();
  let destroyed = false;
  let frame = 0;
  const externalStyle = () => Array.from(container.style).filter(name => name !== blockSizeProperty)
    .map(name => [name, container.style.getPropertyValue(name), container.style.getPropertyPriority(name)]).join('|');
  let rootStyle = externalStyle();
  const reset = () => {
    container.removeAttribute(measuringAttribute);
    container.removeAttribute(activeAttribute);
    restore(container, rootProperties);
    for (const [item, properties] of items) restore(item, properties);
  };
  const schedule = () => {
    if (!destroyed && !frame) frame = view.requestAnimationFrame(layout);
  };
  const resize = new view.ResizeObserver(entries => {
    for (const entry of entries) {
      const box = entry.borderBoxSize?.[0] ?? entry.borderBoxSize;
      const size = entry.target === container ? String(entry.contentRect.width) :
        `${box?.inlineSize ?? entry.contentRect.width}/${box?.blockSize ?? entry.contentRect.height}`;
      if (observed.get(entry.target) !== size) { observed.set(entry.target, size); schedule(); }
    }
  });
  const mutations = new view.MutationObserver(schedule);
  const attributes = new view.MutationObserver(records => {
    const changed = externalStyle();
    if (records.some(record => record.attributeName !== 'style') || changed !== rootStyle) schedule();
    rootStyle = changed;
  });

  function layout() {
    frame = 0;
    if (destroyed) return;
    const children = [...container.children];
    for (const [item, properties] of items) {
      if (item.parentElement !== container) { restore(item, properties); resize.unobserve(item); items.delete(item); }
    }
    if (!container.isConnected || !container.classList.contains('ehven-lanes') ||
        container.dataset.ehvenLanesOrder !== 'horizontal') { reset(); return; }
    for (const item of children) {
      if (!items.has(item)) { items.set(item, snapshot(item, itemProperties)); resize.observe(item, { box: 'border-box' }); }
    }
    // Let CSS resolve its own responsive tracks, including rem/calc()/clamp().
    // All geometry reads occur together before position writes; there is no per-card read/write loop.
    container.setAttribute(activeAttribute, '');
    container.setAttribute(measuringAttribute, '');
    try {
      const style = view.getComputedStyle(container);
      const widths = (style.gridTemplateColumns.match(/(?:\d*\.)?\d+px/g) ?? []).map(number).filter(width => width > 0);
      if (!widths.length || style.writingMode !== 'horizontal-tb') { reset(); return; }
      const gap = number(style.columnGap), rowGap = number(style.rowGap);
      const inlineStart = number(style.paddingInlineStart), blockStart = number(style.paddingBlockStart);
      const padding = blockStart + number(style.paddingBlockEnd);
      const border = number(style.borderBlockStartWidth) + number(style.borderBlockEndWidth);
      const borderBox = style.boxSizing === 'border-box';
      const visible = children.flatMap(item => {
        const itemStyle = view.getComputedStyle(item);
        if (itemStyle.display === 'none') return [];
        const height = number(itemStyle.height) + (itemStyle.boxSizing === 'border-box' ? 0 :
          number(itemStyle.paddingTop) + number(itemStyle.paddingBottom) + number(itemStyle.borderTopWidth) + number(itemStyle.borderBottomWidth));
        const inlineEdges = itemStyle.boxSizing === 'border-box' ? 0 :
          number(itemStyle.paddingLeft) + number(itemStyle.paddingRight) + number(itemStyle.borderLeftWidth) + number(itemStyle.borderRightWidth);
        return [{ item, height, inlineEdges }];
      });
      const tops = widths.map(() => 0);
      let offset = inlineStart;
      const starts = widths.map(width => { const start = offset; offset += width + gap; return start; });
      const positions = visible.map(({ item, height, inlineEdges }, i) => {
        const column = i % widths.length;
        const position = { item, width: Math.max(0, widths[column] - inlineEdges), inline: starts[column], block: blockStart + tops[column] };
        tops[column] += height + rowGap;
        return position;
      });
      const height = visible.length ? Math.max(...tops) - rowGap : 0;
      for (const position of positions) {
        set(position.item, itemProperties[0], `${position.width}px`);
        set(position.item, itemProperties[1], `${position.inline}px`);
        set(position.item, itemProperties[2], `${position.block}px`);
      }
      set(container, blockSizeProperty, `${height + (borderBox ? padding + border : 0)}px`);
    } catch (error) { reset(); throw error; }
    finally { container.removeAttribute(measuringAttribute); }
  }

  const controller = {
    refresh: schedule,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame) view.cancelAnimationFrame(frame);
      resize.disconnect(); mutations.disconnect(); attributes.disconnect();
      reset(); items.clear(); instances.delete(container);
    },
  };
  instances.set(container, controller);
  resize.observe(container);
  mutations.observe(container, { childList: true, subtree: true, characterData: true });
  attributes.observe(container, { attributes: true, attributeFilter: ['class', 'style', 'dir', 'hidden', 'data-ehven-lanes-order'] });
  schedule();
  return controller;
}
