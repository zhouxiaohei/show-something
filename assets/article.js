(() => {
  'use strict';
  const deep = new URLSearchParams(location.search).get('view') === 'deep';
  const pane = document.getElementById('deep-article');
  const directory = document.querySelector('.article-toc details');
  if (directory && matchMedia('(max-width:760px)').matches) directory.open = false;
  if (deep && pane) { document.body.classList.add('deep-mode'); pane.open = true; }
  document.querySelectorAll('[data-view-link]').forEach(link => {
    if (link.dataset.viewLink === (deep ? 'deep' : 'quick')) { link.classList.add('active'); link.setAttribute('aria-current','page'); }
  });
  function locateHash() {
    if (!location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const target = document.getElementById(id);
    if (!target) return;
    if (pane?.contains(target)) pane.open = true;
    target.scrollIntoView({behavior:'instant',block:'start'});
  }
  window.addEventListener('load',locateHash,{once:true});
  window.addEventListener('hashchange',locateHash);
  const dialog = document.querySelector('.figure-dialog');
  if (dialog && typeof dialog.showModal === 'function') {
    document.querySelectorAll('.quick-content figure').forEach(figure => {
      const image = figure.querySelector('img');
      const svg = figure.querySelector('svg');
      if (!image && !svg) return;
      const button = document.createElement('button'); button.type='button';button.className='figure-zoom';button.textContent='放大图示 ↗';
      button.addEventListener('click',() => {
        const canvas = document.querySelector('.figure-dialog-content');
        const copy=(image||svg).cloneNode(true);
        if (!image) {
          copy.querySelectorAll('[id]').forEach(el=>el.id='zoom-'+el.id);
          copy.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(attr=>{
            if(attr.value.includes('url(#'))el.setAttribute(attr.name,attr.value.replaceAll('url(#','url(#zoom-'));
          }));
        }
        canvas.replaceChildren(copy);dialog.showModal();
      });
      figure.append(button);
    });
    dialog.querySelector('.figure-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  }
  const trace=document.getElementById('trace-output');
  if(trace){
    const examples={
      plain:{steps:['模型提出候选最终答复，程序检查本轮是否还有待执行动作。','没有配置额外验收时，程序按结束条件停止本轮。','如果最初漏掉一个要求，模型自己的完成声明仍可能建立在同一误解上。'],verdict:'直接收尾没有增加独立验收；运行结束不自动证明业务成功。'},
      self:{steps:['程序明确新增一次复核请求，把原始要求和候选成果交给同一个模型处理。','模型重新判断覆盖、依据和未决问题，提出修订或认为可以交付。','程序按结果和资源边界决定继续或结束；同一模型仍可能重复原先的误解。'],verdict:'这是额外发起的同模型复核调用，并非仅因模型准备结束就自动具有的能力。'},
      review:{steps:['程序把原始要求、候选成果和独立证据交给评审模型。','评审指出候选成果漏掉的内容，程序决定继续或结束。','评审模型也可能误读原始要求，需要用实际错误校准。'],verdict:'强制评审调用已经发生，不等于评审结论一定正确。'},
      mixed:{steps:['程序先运行文件、测试或状态等已定义的代码检查，把明确失败项送回。','需要时再发起语义复核，提供原始要求与证据，由模型或人判断开放内容。','程序按具体检查结果、授权和预算组织修复、结束或报告未决项。'],verdict:'混合检查结合代码与可选的语义判断；代码通过仍不等于所有开放要求已满足。'}
    };
    const buttons=[...document.querySelectorAll('.mode-buttons button')];
    function select(mode){
      const item=examples[mode];
      if(!item)return;
      buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
      const ol=document.createElement('ol');ol.className='trace';
      item.steps.forEach(text=>{const li=document.createElement('li');li.textContent=text;ol.append(li);});
      const result=document.createElement('p');result.className='trace-verdict';result.textContent=item.verdict;
      trace.replaceChildren(ol,result);
    }
    buttons.forEach(button=>button.addEventListener('click',()=>select(button.dataset.mode)));
    if(buttons.length)select(buttons[0].dataset.mode);
  }
})();
