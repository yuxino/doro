import { startRegionLanguage } from './region-language.ts';

const chinese = {
  "Doro as a shrimp, a puppy, and two blue cats. Spin them around and see every side.": "Doro 虾虾、狗狗，以及两只蓝色呆猫。转一转，看看它们的另一面。",
  "It started with a GIF": "从一张动图开始",
  "Choose a character": "选择角色",
  "Cat on All Fours": "四足呆猫",
  "Blue Cat": "蓝色呆猫",
  "Doro Shrimp": "Doro 虾虾",
  "Doro Puppy": "Doro 狗狗",
  "Shrimp": "虾虾",
  "Puppy": "狗狗",
  "Spin it around. See every side.": "转一转，看看它的另一面。",
  "Doro 3D viewer": "Doro 立体展示",
  "Interactive 3D model of Doro Shrimp": "可旋转的 Doro 虾虾三维模型",
  "Here comes Doro…": "Doro 正在过来…",
  "Loading 3D model": "正在加载立体模型",
  "Model loading progress": "模型加载进度",
  "Try again": "重新加载",
  "Enable JavaScript to explore Doro in 3D.": "开启 JavaScript 后，就能转着看 Doro 了。",
  "Viewer controls": "展示控制",
  "Pause animation": "暂停动画",
  "Play animation": "播放动画",
  "Pause": "暂停",
  "Play": "播放",
  "Front view": "回正面",
  "Head": "看头部",
  "Full view": "看整体",
  "Original GIF": "对照原图",
  "Original reference": "原图对照",
  "The original GIF": "最初的动图",
  "Original GIF of a pink-haired Doro swaying on a curled shrimp body": "原始动图：粉色头发的 Doro 随着弯曲的虾身摆动",
  "The original GIF could not load.": "原图暂时没加载出来",
  "The one that started it all.": "就是从这只开始的。",
  "Drag to rotate": "拖动旋转",
  "Scroll or pinch to zoom": "滚轮或双指缩放",
  "Doro is cute. So are shrimp.": "Doro 可爱，虾也可爱。",
  "Focus the model, then use arrow keys to rotate, plus and minus to zoom, and Home for the front view.": "聚焦模型后，可用方向键旋转，加减键缩放，Home 键回到正面。",
  "The same little head, now with four tiny legs.": "同一颗小脑袋，换了四只小短腿。",
  "Round face, big ears, standing still for you.": "圆脸、大耳朵，站好给你看看。",
  "That little face, with four little paws.": "呆猫的脑袋，配上四只小猫腿。",
  "Paused for reduced motion. Press Play whenever you like.": "已按系统偏好暂停，可随时点播放。",
  "Paused. Take a look around.": "停一会儿，转着看看。",
  "Meow meow, running all around.": "咪咪喵喵地跑来跑去",
  "The viewer paused": "展示暂时停了一下",
  "Reload to keep exploring.": "重新加载就能再转着看。",
  "The 3D model could not load": "3D 暂时没加载出来",
  "Try again, or come back in a moment.": "可以再试一次，或稍后回来看看。",
  "Almost there…": "快好啦…",
  "Language": "语言"
};
// This accepts an IP geolocation country code, never navigator.language or a locale tag.
export function detectLanguage(country) {
  return typeof country === 'string' && ['CN', 'HK', 'MO', 'TW'].includes(country) ? 'zh' : 'en';
}
export let language = 'en';
const bindings = new Map();
const staticText = [];
const attributes = [];
let initialized = false;
export function t(value) {
  if (language === 'en') return value;
  if (chinese[value]) return chinese[value];
  if (value.startsWith('Here comes ') && value.endsWith('…')) return t(value.slice(11, -1)) + '正在过来…';
  if (value.startsWith('Interactive 3D model of ')) return '可旋转的 ' + t(value.slice(24)) + '三维模型';
  if (value.startsWith('Loading 3D model · ')) return chinese['Loading 3D model'] + value.slice('Loading 3D model'.length);
  return value;
}
export function setText(element, value) {
  bindings.set(element, value);
  element.textContent = t(value);
}
function apply() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  for (const [node, original] of staticText) if (node.isConnected) node.textContent = original.replace(original.trim(), t(original.trim()));
  for (const [element, attr, original] of attributes) element.setAttribute(attr, t(original));
  for (const [element, original] of bindings) element.textContent = t(original);
  for (const button of document.querySelectorAll('[data-language]')) button.setAttribute('aria-pressed', String(button.dataset.language === language));
}
export function initializeLanguage() {
  if (initialized) return;
  initialized = true;
  const dynamic = '[data-mode], #play-label, #head, #motion-note, #load-title, #load-detail, #cat-caption';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest(dynamic) && chinese[node.textContent.trim()]) staticText.push([node, node.textContent]);
  }
  for (const element of document.querySelectorAll('[aria-label], [alt], meta[name="description"]')) {
    if (element.id === 'canvas' || element.id === 'play') continue;
    for (const attr of ['aria-label', 'alt', 'content']) if (element.hasAttribute(attr)) attributes.push([element, attr, element.getAttribute(attr)]);
  }
  startRegionLanguage((nextLanguage) => {
    language = nextLanguage;
    apply();
    window.dispatchEvent(new Event('doro-languagechange'));
  });
}
