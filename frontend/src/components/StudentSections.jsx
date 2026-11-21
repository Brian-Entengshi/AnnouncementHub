import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Clock3,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from 'lucide-react'

function SectionLink({ section, className, children, preview }) {
  return preview ? (
    <span className={className}>{children}</span>
  ) : (
    <Link className={className} to={'/student#' + section}>
      {children}
    </Link>
  )
}

export function PublicHomeSection({ content, preview = false }) {
  const section = content.hero_cta_section || 'events'
  const customImage = content.hero_image
  return (
    <div className="public-hero">
      <div className="public-width public-hero-grid">
        <div className="public-hero-copy">
          {content.hero_welcome && (
            <p className="public-kicker">{content.hero_welcome}</p>
          )}
          <h1>{content.hero_heading || 'DLL Elite Student Club'}</h1>
          {content.hero_description && (
            <p className="public-hero-description">
              {content.hero_description}
            </p>
          )}
          <div className="public-hero-actions">
            <SectionLink
              section={section}
              className="public-primary"
              preview={preview}
            >
              {content.hero_cta_label || 'Explore Club Events'}{' '}
              <ArrowDown size={17} aria-hidden="true" />
            </SectionLink>
            {section !== 'announcements' && (
              <SectionLink
                section="announcements"
                className="public-hero-link"
                preview={preview}
              >
                Read announcements <ArrowRight size={16} aria-hidden="true" />
              </SectionLink>
            )}
          </div>
        </div>
        <div className="public-hero-visual">
          <img
            src={customImage || '/brand/campus.png'}
            alt={customImage ? content.hero_image_alt || '' : ''}
            width="960"
            height="640"
            fetchPriority={preview ? undefined : 'high'}
          />
        </div>
      </div>
    </div>
  )
}

export function PublicAboutSection({ content }) {
  const facts = [
    ['Purpose', content.about_purpose],
    ['Mission', content.about_mission],
    ['Vision', content.about_vision],
  ].filter(([, text]) => text)
  return (
    <div className="public-width">
      <div className="public-about">
        <div className="public-about-emblem">
          <img
            src="/brand/seal.png"
            alt="DLL Elite seal"
            width="210"
            height="210"
            loading="lazy"
          />
        </div>
        <div className="public-about-copy public-section-heading">
          <h2>{content.about_heading || 'About DLL Elite'}</h2>
          {content.about_intro && (
            <p className="public-lead">{content.about_intro}</p>
          )}
          {content.about_description && (
            <p className="public-prose">{content.about_description}</p>
          )}
        </div>
      </div>
      {facts.length > 0 && (
        <div className="public-about-facts">
          {facts.map(([title, text]) => (
            <section className="public-about-fact" key={title}>
              <h3>{title}</h3>
              <p className="public-prose">{text}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export function PublicContactsSection({ content, preview = false }) {
  const channels = [
    [
      Mail,
      'Email',
      content.contact_email,
      content.contact_email ? 'mailto:' + content.contact_email : '',
    ],
    [
      Phone,
      'Phone',
      content.contact_phone,
      content.contact_phone
        ? 'tel:' + content.contact_phone.replace(/[^\d+]/g, '')
        : '',
    ],
    [MapPin, 'Office location', content.office_location],
    [Clock3, 'Office hours', content.office_hours],
    [
      MessageCircle,
      'Facebook',
      content.facebook_url && 'Follow DLL Elite on Facebook',
      content.facebook_url,
      true,
    ],
    [
      Camera,
      'Instagram',
      content.instagram_url && 'Follow DLL Elite on Instagram',
      content.instagram_url,
      true,
    ],
    [
      Globe,
      'Organization website',
      content.website_url && 'Visit the official website',
      content.website_url,
      true,
    ],
  ].filter(([, , text]) => text)
  return (
    <div className="public-width public-contact-layout">
      <div className="public-section-heading">
        <h2>{content.contact_heading || 'Contacts'}</h2>
        {content.contact_intro && (
          <p className="public-prose">{content.contact_intro}</p>
        )}
      </div>
      {channels.length ? (
        <div className="public-contact-grid">
          {channels.map(([Icon, label, text, href, external]) => {
            const body = (
              <>
                <span className="public-contact-icon">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <div>
                  <h3>{label}</h3>
                  <p className="public-prose">{text}</p>
                </div>
                {href && !preview && (
                  <ArrowUpRight
                    className="public-contact-arrow"
                    size={16}
                    aria-hidden="true"
                  />
                )}
              </>
            )
            return href && !preview ? (
              <a
                key={label}
                className="public-contact-card"
                href={href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
              >
                {body}
              </a>
            ) : (
              <div key={label} className="public-contact-card">
                {body}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="public-contact-empty">
          <span className="public-contact-icon">
            <Mail size={20} aria-hidden="true" />
          </span>
          <p>Contact details haven’t been published yet.</p>
        </div>
      )}
    </div>
  )
}
