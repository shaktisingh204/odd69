'use client';

import Script from 'next/script';

export default function ChatwootWidget() {
  return (
    <Script
      id="chatwoot-widget"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(d,t) {
            var BASE_URL="https://chatwoot-zeero-u27309.vm.elestio.app";
            var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
            g.src=BASE_URL+"/packs/js/sdk.js";
            g.async = true;
            s.parentNode.insertBefore(g,s);
            g.onload=function(){
              window.chatwootSDK.run({
                websiteToken: 'qNdMgAftG3XJQvYt7pVbMZFU',
                baseUrl: BASE_URL
              })
            }
          })(document,"script");
        `,
      }}
    />
  );
}
