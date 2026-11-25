"use client";

import Link from "next/link";
import { useState } from "react";
import { ANNUAL_MONTHS_PAID, ENTERPRISE_CONTACT, FEATURES, PLANS, priceFor, type Audience, type Billing } from "./plans";
import styles from "./pricing.module.scss";

const audiences: Array<{ id: Audience; label: string }> = [
  { id: "individual", label: "Individuals" },
  { id: "organisation", label: "Organisations" },
];

function planHref(planId: string, billing: Billing) {
  if (planId === "free") return "/register";
  if (planId === "enterprise") return ENTERPRISE_CONTACT;
  return "/register?plan=" + planId + "&billing=" + billing;
}

function Check({ on }: { on: boolean }) {
  return on ? (
    <svg className={styles.yes} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Included"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
  ) : (
    <span className={styles.no} role="img" aria-label="Not included">—</span>
  );
}

export default function PricingPlans() {
  const [audience, setAudience] = useState<Audience>("individual");
  const [billing, setBilling] = useState<Billing>("annual");
  const plans = PLANS.filter((plan) => plan.audience === audience);
  const rows = FEATURES[audience];
  const freeMonths = 12 - ANNUAL_MONTHS_PAID;

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.segment} role="radiogroup" aria-label="Who is this for?">
          {audiences.map((option) => (
            <button key={option.id} type="button" role="radio" aria-checked={audience === option.id} className={audience === option.id ? styles.segmentOn : undefined} onClick={() => setAudience(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
        <div className={styles.segment} role="radiogroup" aria-label="Billing period">
          <button type="button" role="radio" aria-checked={billing === "monthly"} className={billing === "monthly" ? styles.segmentOn : undefined} onClick={() => setBilling("monthly")}>Monthly</button>
          <button type="button" role="radio" aria-checked={billing === "annual"} className={billing === "annual" ? styles.segmentOn : undefined} onClick={() => setBilling("annual")}>
            Annual <span className={styles.save}>{freeMonths} months free</span>
          </button>
        </div>
      </div>

      <div className={styles.plans}>
        {plans.map((plan) => {
          const price = priceFor(plan, billing);
          const external = plan.id === "enterprise";
          const Cta = external ? "a" : Link;
          return (
            <article key={plan.id} className={plan.popular ? styles.planPopular : styles.plan}>
              {plan.popular && <span className={styles.badge}>Most popular</span>}
              <h3>{plan.name}</h3>
              <p className={styles.tagline}>{plan.tagline}</p>
              <p className={styles.price}><strong>{price.main}</strong>{price.unit && <span> {price.unit}</span>}</p>
              <p className={styles.priceSub}>{price.sub}</p>
              <Cta className={plan.popular ? styles.ctaPrimary : styles.cta} href={planHref(plan.id, billing)}>{plan.cta}</Cta>
              <ul>
                {plan.highlights.map((item) => (
                  <li key={item}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>{item}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <section className={styles.compare} aria-labelledby="compare-heading">
        <h2 id="compare-heading">Compare plans</h2>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col"><span className={styles.srOnly}>Feature</span></th>
                {plans.map((plan) => <th key={plan.id} scope="col" className={plan.popular ? styles.popularCol : undefined}>{plan.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}{row.soon && <span className={styles.soon}>Soon</span>}</th>
                  {row.values.map((value, index) => (
                    <td key={plans[index].id} className={plans[index].popular ? styles.popularCol : undefined}>
                      {typeof value === "string" ? value : <Check on={value} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
