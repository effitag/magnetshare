import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

const CONTACT_EMAIL = "magnetimshare@gmail.com";

/** A paragraph, optionally opening with a bold lead-in. */
type Paragraph = { lead?: string; text: string };

/** A section: an optional heading, then paragraphs, then a bullet list. */
type Section = {
  heading?: string;
  paragraphs?: Paragraph[];
  bullets?: string[];
};

type Page = {
  title: string;
  updated: string;
  sections: Section[];
};

const pages: Record<"privacy" | "terms" | "accessibility", Page> = {
  terms: {
    title: "תנאי שימוש (תקנון)",
    updated: "עודכן לאחרונה: 16.11.2026",
    sections: [
      {
        heading: "1. כללי",
        paragraphs: [
          {
            // TODO: insert the company's formal legal entity name and
            // registration number after "MagnetimShare" once available.
            text: 'האתר magnetimshare.com והשירות MagnetimShare (להלן: "השירות") מופעלים על ידי MagnetimShare (להלן: "החברה"). גלישה באתר או שימוש בשירות מהווים הסכמה לתנאים אלה. התנאים מנוסחים בלשון זכר מטעמי נוחות ופונים לכל המגדרים.',
          },
        ],
      },
      {
        heading: "2. השירות",
        paragraphs: [
          {
            text: "MagnetimShare מפיקה מגנטים מצולמים באירועים: אורחי האירוע מצלמים תמונות דרך דפדפן הטלפון, בתוך מסגרת המעוצבת לאירוע, והתמונות מודפסות כמגנטים בעמדת הדפסה באירוע עצמו. היקף השירות, מכסת המגנטים לאורח ושעות הפעילות נקבעים בהזמנה מול מזמין האירוע.",
          },
        ],
      },
      {
        heading: "3. שימוש בשירות",
        bullets: [
          "הצילום מיועד לאורחי האירוע בלבד, באמצעות הקישור או קוד ה-QR שסופק לאותו אירוע.",
          "לכל אורח מכסת מגנטים הנקבעת לאירוע. החברה רשאית לסיים את קליטת התמונות בסיום האירוע.",
          "החברה רשאית, לפי שיקול דעתה, שלא להדפיס תוכן פוגעני, בלתי חוקי או שאינו הולם את אופי האירוע.",
        ],
      },
      {
        heading: "4. תמונות וקניין רוחני",
        bullets: [
          "הזכויות בתמונות המצולמות שייכות למצלמיהן או למזמין האירוע, לפי העניין. בשליחת תמונה מצהיר האורח כי יש לו הזכות לצלמה ולהדפיסה.",
          "מזמין האירוע אחראי לכך שהשימוש בשמות, בעיצובים ובסימנים הנלווים לאירוע נעשה ברשות בעליהם.",
          "החברה אינה עושה שימוש בתמונות מעבר להפקת המגנטים ולתפעול השירות, אלא בהסכמה נפרדת ומפורשת.",
          "עיצובי המסגרות, האתר והמותג MagnetimShare הם קניינה של החברה ואין להעתיקם ללא רשות.",
        ],
      },
      {
        heading: "5. אחריות",
        paragraphs: [
          {
            text: "מתן השירות תלוי, בין היתר, בחיבור אינטרנט, בחשמל ובציוד ההדפסה במקום האירוע. החברה תפעל באופן מקצועי וסביר למתן השירות. אחריות החברה מוגבלת לסכום ששולם בפועל עבור השירות באותו אירוע, והיא לא תישא בנזק עקיף או תוצאתי.",
          },
        ],
      },
      {
        heading: "6. הזמנות, תשלום וביטול",
        paragraphs: [
          {
            text: "תנאי ההזמנה, התשלום והביטול נקבעים בהצעת המחיר או בהסכם ההזמנה מול מזמין האירוע.",
          },
        ],
      },
      {
        heading: "7. דין וסמכות שיפוט",
        paragraphs: [
          {
            text: "על תנאים אלה יחול דין מדינת ישראל, וסמכות השיפוט הייחודית נתונה לבתי המשפט המוסמכים במחוז מרכז.",
          },
        ],
      },
      {
        heading: "8. יצירת קשר",
        paragraphs: [{ text: `לשאלות על תנאים אלה: ${CONTACT_EMAIL}.` }],
      },
    ],
  },
  privacy: {
    title: "מדיניות פרטיות",
    updated: "עודכן לאחרונה: 16.11.2026",
    sections: [
      {
        heading: "1. מי אנחנו",
        paragraphs: [
          {
            // TODO: insert the company's formal legal entity name and
            // registration number after "MagnetimShare" once available.
            text: `מדיניות זו מתארת כיצד MagnetimShare ("החברה") אוספת ומעבדת מידע אישי באתר magnetimshare.com ובשירות המגנטים באירועים. לכל שאלה או בקשה: ${CONTACT_EMAIL}.`,
          },
        ],
      },
      {
        heading: "2. איזה מידע נאסף",
        bullets: [
          "טופס יצירת קשר באתר: שם, מספר טלפון וסוג האירוע, כפי שנמסרו על ידיכם.",
          "צילום באירוע: התמונות שהאורח מצלם ושולח, מזהה טכני אנונימי של הדפדפן (ללא שם, טלפון או הרשמה) וסטטוס ההדפסה של כל תמונה.",
          "מידע תפעולי: נתונים טכניים הדרושים לאבטחה ולתפעול תקין של המערכת.",
        ],
      },
      {
        heading: "3. למה המידע משמש",
        paragraphs: [
          {
            text: "לחזור אל פונים ולתאם את האירוע; להפיק, להדפיס ולמסור את המגנטים; ולתפעול, אבטחה ושיפור השירות. המידע אינו נמכר ואינו משמש לפרסום של צדדים שלישיים.",
          },
        ],
      },
      {
        heading: "4. מי נחשף למידע",
        bullets: [
          "כל אורח רואה רק את התמונות שהוא עצמו צילם.",
          "צוות ההפעלה באירוע ומנהלי המערכת נחשפים לתמונות לצורך הדפסה, מסירה ובקרת תוכן בלבד.",
          "המידע מאוחסן אצל ספקי תשתית ענן (אחסון ומסד נתונים) הפועלים עבור החברה ומחויבים לאבטחתו.",
        ],
      },
      {
        heading: "5. שמירה ומחיקה",
        paragraphs: [
          {
            text: `התמונות ופרטי הפנייה נשמרים לפרק הזמן הנדרש למתן השירות ולצרכים תפעוליים, לפי שיקול דעת החברה. ניתן לבקש מחיקת תמונות או פרטים בכל עת בפנייה אל ${CONTACT_EMAIL}, והבקשה תטופל בתוך זמן סביר.`,
          },
        ],
      },
      {
        heading: "6. זכויותיכם",
        paragraphs: [
          {
            text: `בהתאם לחוק הגנת הפרטיות, התשמ"א-1981, עומדת לכם הזכות לעיין במידע שנאסף עליכם, לבקש את תיקונו או את מחיקתו. פנייה: ${CONTACT_EMAIL}.`,
          },
        ],
      },
      {
        heading: "7. אבטחת מידע",
        paragraphs: [
          {
            text: "החברה מיישמת אמצעי אבטחה מקובלים, ובהם הצפנת תעבורה, הפרדת הרשאות גישה ובידוד מידע בין אורחים. אין באמצעים אלה כדי להבטיח חסינות מוחלטת.",
          },
        ],
      },
      {
        heading: "8. קטינים",
        paragraphs: [
          {
            text: "הצילום באירועים נעשה ביוזמת האורחים. צילום קטינים באירוע הוא באחריות המצלם ומזמין האירוע.",
          },
        ],
      },
      {
        heading: "9. עדכונים",
        paragraphs: [
          {
            text: "החברה רשאית לעדכן מדיניות זו מעת לעת; הנוסח המחייב הוא זה המפורסם באתר.",
          },
        ],
      },
    ],
  },
  accessibility: {
    title: "הצהרת נגישות",
    updated: "עודכן לאחרונה: נובמבר 2026",
    sections: [
      {
        paragraphs: [
          {
            lead: "מחויבות.",
            text: 'MagnetimShare רואה חשיבות במתן שירות שוויוני ונגיש לאנשים עם מוגבלות, בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח-1998, ולתקנות הנגישות לשירות שהותקנו מכוחו.',
          },
          {
            lead: "נגישות האתר.",
            text: 'האתר נבנה מתוך כוונה לעמוד בהנחיות הנגישות של התקן הישראלי (ת"י 5568), המבוסס על הנחיות WCAG ברמה AA, ובכלל זה: התאמה לשימוש בטלפון נייד, אפשרות ניווט במקלדת, טקסט חלופי לתמונות וניגודיות צבעים מספקת. האתר תואם חלקית — ייתכנו רכיבים שטרם הונגשו במלואם, ואנו פועלים לשיפור מתמיד.',
          },
          {
            lead: "נגישות השירות באירוע.",
            text: "הצילום נעשה מהטלפון האישי של כל אורח, ועמדת ההדפסה מופעלת במקום האירוע. אורח הזקוק לסיוע או להתאמה מוזמן לפנות לצוות העמדה, ונשמח לסייע.",
          },
          {
            lead: "נתקלתם בקושי?",
            text: `נשמח לדעת ולתקן. פנו אלינו במייל ${CONTACT_EMAIL} וציינו את הדף או הרכיב שבו נתקלתם בקושי. נשיב בתוך זמן סביר ונפעל לתקן ככל הניתן.`,
          },
        ],
      },
    ],
  },
};

/** The text, with the contact email as a mail link. */
function withEmailLink(text: string): ReactNode {
  const parts = text.split(CONTACT_EMAIL);
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 ? (
        <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="whitespace-nowrap text-primary underline">
          {CONTACT_EMAIL}
        </a>
      ) : null}
    </Fragment>
  ));
}

export function LegalPage({ kind }: { kind: keyof typeof pages }) {
  const page = pages[kind];
  return (
    <main className="min-h-screen overflow-x-hidden bg-paper px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]">
      <Link to="/" className="inline-flex min-h-11 items-center font-display text-lg text-primary">
        MagnetimShare
      </Link>
      <article className="max-w-2xl">
        <h1 className="mt-6 font-display text-4xl leading-tight text-ink">{page.title}</h1>
        <p className="mt-3 text-sm text-muted">{page.updated}</p>
        {page.sections.map((section, index) => (
          <section key={section.heading ?? index} className="mt-7">
            {section.heading ? (
              <h2 className="font-display text-xl leading-snug text-ink">{section.heading}</h2>
            ) : null}
            {section.paragraphs?.map((paragraph, pIndex) => (
              <p key={pIndex} className={`${section.heading || pIndex > 0 ? "mt-3" : ""} text-base leading-relaxed text-ink`}>
                {paragraph.lead ? <strong className="font-semibold">{paragraph.lead} </strong> : null}
                {withEmailLink(paragraph.text)}
              </p>
            ))}
            {section.bullets ? (
              <ul className="mt-3 list-disc space-y-2 ps-5 text-base leading-relaxed text-ink marker:text-primary">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{withEmailLink(bullet)}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </article>
    </main>
  );
}
