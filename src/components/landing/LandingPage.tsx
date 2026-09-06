import { LandingNav } from './LandingNav';
import { Hero } from './Hero';
import { LearningMethod } from './LearningMethod';
import { CourseShowcase } from './CourseShowcase';
import { StudyFeatures } from './StudyFeatures';
import { LandingClosing, LandingFooter } from './LandingClosing';
import s from './landing.module.css';

export function LandingPage() {
  return <div className={s.landing} data-landing-page>
    <LandingNav />
    <main id="main-content"><Hero /><LearningMethod /><CourseShowcase /><StudyFeatures /><LandingClosing /></main>
    <LandingFooter />
  </div>;
}
