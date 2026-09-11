-- A few words somebody who has worked with me agreed to put their name to,
-- collected through the form at `/vouch`. See `Testimonial` in the schema.
--
-- The only table here a stranger writes, which is why every column is NOT NULL:
-- there is no half-filled testimonial worth keeping, and a row that arrived
-- through `TestimonialSubmissionSchema` has all three parts by construction.
--
-- The UNIQUE on `linkedinUrl` is the load-bearing line. It makes the profile the
-- natural key, so a second submission from the same person is an UPDATE of their
-- own words rather than a duplicate row — a typo is fixed by sending the form
-- again, and an open link cannot be used to write the same name a thousand
-- times. It is only safe as a key because the value is normalised before it
-- gets here (`LinkedInProfileUrlSchema`): one spelling per profile.
--
-- No length on `quote`. The 280-character brief lives in
-- `TESTIMONIAL_QUOTE_MAX_LENGTH`, which the form's counter and the schema both
-- read; a VARCHAR(280) here would be a second copy that a change to the brief
-- would have to remember to migrate. Same call `Component.aspect` makes.
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "linkedinUrl" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Testimonial_linkedinUrl_key" ON "Testimonial"("linkedinUrl");
