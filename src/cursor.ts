function getSvgForCursor(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="19" viewBox="0 0 12 19">
  <path fill="#000" d="M0 0h1v16H0V0Zm1 1h1v1H1V1Zm6 6h1v1H7V7ZM4 4h1v1H4V4Zm6 6h1v1h-1v-1Zm-9 5h1v1H1v-1Zm1-1h1v1H2v-1Zm5-2h4v1H7v-1ZM2 2h1v1H2V2Zm6 6h1v1H8V8ZM5 5h1v1H5V5Zm6 6h1v2h-1v-2ZM3 3h1v1H3V3Zm6 6h1v1H9V9Zm-6 4h1v1H3v-1Zm4 0h1v1H7v-1Zm1 1h1v2H8v-2Zm1 2h1v2H9v-2Zm-5-2h1v2H4v-2Zm1 2h1v2H5v-2Zm1 2h3v1H6v-1ZM6 6h1v1H6V6Z"/>
  <path fill="${color}" d="M2 2H1v13h1v-1h1v-1h1v1h1v2h1v2h3v-2H8v-2H7v-2h4v-1h-1v-1H9V9H8V8H7V7H6V6H5V5H4V4H3V3H2V2Z"/>
</svg>
`;
}

export function renderCursor(id: string, color: string): HTMLElement {
  const htmlFragment = `<div id="cursor-${id}" class="cursor">
      ${getSvgForCursor(color)}
      <audio id="audio-${id}" autoplay></audio>
    </div>`;
  const template = document.createElement("template");
  template.innerHTML = htmlFragment;
  const cursorEl = template.content.firstChild as HTMLElement;
  return cursorEl;
}
