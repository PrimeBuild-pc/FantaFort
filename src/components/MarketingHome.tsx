import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { communityCopy, DISCORD_URL } from '@/lib/community';
import { homeCopy, marketingPath } from '@/lib/marketing';
import MarketingFooter from './MarketingFooter';
import MarketingHeader from './MarketingHeader';

export default function MarketingHome({ locale }: { locale: Locale }) {
  const text = homeCopy[locale];
  const community = communityCopy[locale];
  const signupHref = '/auth?mode=signup';
  const schema = {
    '@context':'https://schema.org', '@graph':[
      {'@type':'WebSite','@id':'https://fantafort.com/#website',name:'FantaFort',url:'https://fantafort.com/',inLanguage:['en','it','es','de','fr']},
      {'@type':'WebApplication','@id':'https://fantafort.com/#app',name:'FantaFort',url:'https://fantafort.com/',applicationCategory:'GameApplication',operatingSystem:'Web',isAccessibleForFree:true,description:text.intro},
    ]
  };
  return <div className="marketing-shell" lang={locale}>
    <MarketingHeader locale={locale}/>
    <main>
      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}<br/><em>{text.accent}</em></h1>
          <p>{text.intro}</p>
          <div className="landing-actions"><Link className="epic-button huge" href={signupHref}>{text.signup}</Link><Link className="epic-button secondary huge" href="/auth">{text.signin}</Link></div>
          <small className="signup-note">{text.signupNote}</small>
          <Link className="hero-learn-link" href={marketingPath(locale,'/how-it-works')}>{text.learn} →</Link>
        </div>
      </section>

      <section className="marketing-section landing-steps">
        <div className="section-intro"><p className="eyebrow">FANTAFORT · 01</p><h2>{text.worksTitle}</h2></div>
        <ol>{text.steps.map((step,index)=><li key={step}><span>0{index + 1}</span><p>{step}</p></li>)}</ol>
      </section>

      <section className="marketing-section landing-value">
        <div><p className="eyebrow">FANTAFORT</p><h2>{text.whyTitle}</h2></div>
        <ul>{text.benefits.map(item=><li key={item}>✓ <span>{item}</span></li>)}</ul>
        <aside><p className="eyebrow">{text.dataTitle}</p><p>{text.dataBody}</p><small>{text.fairBody}</small></aside>
      </section>

      <section className="marketing-section community-callout"><div><h2>{community.title}</h2><p>{community.body}</p></div><a className="epic-button huge" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">{community.discord}</a></section>

      <section className="marketing-cta"><h2>{text.ctaTitle}</h2><p>{text.ctaBody}</p><Link className="epic-button huge" href={signupHref}>{text.signup}</Link></section>
    </main>
    <MarketingFooter locale={locale}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replaceAll('<','\\u003c')}}/>
  </div>;
}
