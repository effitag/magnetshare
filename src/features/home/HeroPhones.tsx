/**
 * The hero's product shot: two phones showing the guest camera, each with a
 * sample designed magnet in the frame. Pure HTML and CSS (styles in
 * theme.css, under "Hero phones"); only the two photos are images. Each
 * phone is decorative and described by its aria-label.
 */

type PhoneProps = {
  size: "large" | "small";
  label: string;
  quota: string;
  photo: string;
  firstName: string;
  secondName: string;
  heartClass: string;
  date: string;
};

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function FlashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2L5 13h5l-1 9 8-11h-5l1-9z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12a9 9 0 1 1-3-6.7M21 3v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Heart({ className }: { className: string }) {
  return (
    <svg className={`mag-heart ${className}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function Phone({ size, label, quota, photo, firstName, secondName, heartClass, date }: PhoneProps) {
  return (
    <div className={`phone phone-${size}`} role="img" aria-label={label}>
      <span className="phone-btn phone-btn-silent" />
      <span className="phone-btn phone-btn-vol-up" />
      <span className="phone-btn phone-btn-vol-down" />
      <span className="phone-btn phone-btn-power" />
      <div className="phone-bezel">
        <div className="phone-screen">
          <div className="phone-island">
            <span className="phone-lens" />
          </div>
          <div className="phone-cam-top">
            <span className="phone-cam-glass">
              <CloseIcon />
            </span>
            <span className="phone-cam-quota">{quota}</span>
          </div>
          <div className="phone-cam-mid">
            <div className="mag-card">
              <div className="mag-photo">
                <img src={photo} alt="" loading="eager" decoding="async" />
              </div>
              <div className="mag-caption">
                <span className="mag-names">
                  {firstName} <Heart className={heartClass} /> {secondName}
                </span>
                <span className="mag-date">{date}</span>
              </div>
            </div>
          </div>
          <div className="phone-cam-controls">
            <span className="phone-cam-glass">
              <FlashIcon />
            </span>
            <span className="phone-shutter">
              <span />
            </span>
            <span className="phone-cam-glass">
              <FlipIcon />
            </span>
          </div>
          <div className="phone-glare" />
        </div>
      </div>
    </div>
  );
}

export function HeroPhones() {
  return (
    <div className="phone-stage">
      <Phone
        size="small"
        label="טלפון במצלמת האורחים, ובמסגרת מגנט מעוצב עם תמונה מרחבת הריקודים"
        quota="4 נותרו"
        photo="/landing/dance-floor.jpg"
        firstName="רון"
        secondName="מאיה"
        heartClass="text-ink"
        date="21.06.2026"
      />
      <Phone
        size="large"
        label="טלפון במצלמת האורחים, ובמסגרת מגנט מעוצב עם תמונה של זוג בחתונה"
        quota="5 נותרו"
        photo="/landing/wedding-couple.jpg"
        firstName="נועה"
        secondName="איתי"
        heartClass="text-primary"
        date="14.08.2026"
      />
    </div>
  );
}
