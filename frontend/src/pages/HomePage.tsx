import React, { useState, useEffect, useId } from 'react';
import { Container } from '../components/ui/Container';
import { Section } from '../components/ui/Section';
import { SectionTitle } from '../components/ui/SectionTitle';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ArrowLink } from '../components/ui/ArrowLink';
import {
  ShieldCheck,
  Search,
  FileCheck,
  Award,
  Wallet,
  ArrowRight,
  ChevronRight,
  Pause,
  Play,
  Layers,
  HardDrive,
  Cpu,
  Fingerprint,
  UploadCloud,
  Database,
  GraduationCap,
  Briefcase,
  Building2,
  Lock,
  BookOpen,
  Sparkles,
  ScrollText,
} from 'lucide-react';

interface HomePageProps {
  onNavigateToTab: (tab: 'issue' | 'recipient' | 'verify') => void;
  onNavigateToVerify: (certId: string) => void;
}

const HERO_SLIDES = [
  {
    id: 'verify-first',
    kicker: 'DECENTRALIZED CREDENTIAL PROTOCOL',
    title: 'Issue and verify credentials you can trust',
    description:
      'Tamper-proof academic degrees, diplomas, and enterprise certificates anchored to Ethereum smart contracts and pinned to decentralized IPFS storage.',
    ctaPrimary: 'Verify a Certificate',
    ctaPrimaryTab: 'verify' as const,
    ctaSecondary: 'Issue Credentials',
    ctaSecondaryTab: 'issue' as const,
  },
  {
    id: 'institution-first',
    kicker: 'FOR UNIVERSITIES & ACCREDITATION BODIES',
    title: 'Instant zero-knowledge cryptographic credential issuance',
    description:
      'Eliminate diploma fraud and manual background checks. Issue verifiable digital credentials with client-side SHA-256 canonical hashing.',
    ctaPrimary: 'Explore Issuer Flow',
    ctaPrimaryTab: 'issue' as const,
    ctaSecondary: 'My Wallet Credentials',
    ctaSecondaryTab: 'recipient' as const,
  },
  {
    id: 'holder-first',
    kicker: 'FOR STUDENTS & ACCREDITED PROFESSIONALS',
    title: 'Own your credentials forever in your Web3 wallet',
    description:
      'Export high-resolution PDF/PNG certificates with embedded verification QR codes readable by any employer or regulatory agency globally.',
    ctaPrimary: 'View My Certificates',
    ctaPrimaryTab: 'recipient' as const,
    ctaSecondary: 'Verify Existing Record',
    ctaSecondaryTab: 'verify' as const,
  },
];

const STATIC_ACTIVITY_FEED = [
  {
    date: '2026-10-02',
    title: 'Executive Diploma in Blockchain Cybersecurity issued to Alice Nakamoto',
    certId: '0x3a4b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
  },
  {
    date: '2026-10-01',
    title: 'Master of Science in Smart Contract Systems issued to David Chen',
    certId: '0x11223344556677889900aabbccddeeff00112233445566778899aabbccddeeff',
  },
  {
    date: '2026-09-29',
    title: 'Decentralized Identity & Zero Knowledge Proofs Workshop Credential issued',
    certId: '0x99887766554433221100ffeeddccbbaa99887766554433221100ffeeddccbbaa',
  },
  {
    date: '2026-09-28',
    title: 'Annual Autonomous Security Auditor License authorized on Ethereum Sepolia',
    certId: '0xaa11bb22cc33dd44ee55ff6677889900aabbccddeeff11223344556677889900',
  },
];

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToTab,
  onNavigateToVerify,
}) => {
  const [heroSearchInput, setHeroSearchInput] = useState('');
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);

  // Overlapping Announcements Carousel State
  const [activityIndex, setActivityIndex] = useState(0);
  const [isActivityPlaying, setIsActivityPlaying] = useState(true);

  // Animated 4-step diagram state
  const [activeStep, setActiveStep] = useState(0);
  const [isDiagramPlaying, setIsDiagramPlaying] = useState(true);

  // Hero carousel auto-advance
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Announcements auto-advance
  useEffect(() => {
    if (!isActivityPlaying) return;
    const timer = setInterval(() => {
      setActivityIndex((prev) => (prev + 1) % STATIC_ACTIVITY_FEED.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isActivityPlaying]);

  // Diagram step timer
  useEffect(() => {
    if (!isDiagramPlaying) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(timer);
  }, [isDiagramPlaying]);

  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroSearchInput.trim()) {
      onNavigateToVerify(heroSearchInput.trim());
    } else {
      onNavigateToTab('verify');
    }
  };

  const roleTitleId = useId();
  const fitsTitleId = useId();

  return (
    <div className="flex flex-col w-full">
      {/* ========================================================================= */}
      {/* 4.1 HERO SECTION WITH CAROUSEL, VERIFY SEARCH, & OVERLAPPING ABSTRACT SVG */}
      {/* ========================================================================= */}
      <div className="relative bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 text-white overflow-hidden pt-8 sm:pt-14 pb-20 sm:pb-28">
        {/* Abstract Blockchain Pattern Background with Bottom Fade */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10 [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]"
          aria-hidden="true"
        >
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="blockchain-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" />
                <circle cx="0" cy="0" r="3" fill="#60a5fa" />
                <circle cx="60" cy="0" r="2" fill="#93c5fd" />
                <circle cx="0" cy="60" r="2" fill="#93c5fd" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#blockchain-grid)" />
          </svg>
        </div>

        <Container size="xl" className="relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column: Headline & Verification Search Box */}
            <div className="lg:col-span-7 space-y-6">
              {/* Slide Kicker */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-azure-500/20 text-azure-300 border border-azure-400/30 text-xs font-bold uppercase tracking-wider">
                <Sparkles size={13} className="text-gold-400" />
                <span>{HERO_SLIDES[currentHeroSlide].kicker}</span>
              </div>

              {/* Dynamic Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] text-white">
                {HERO_SLIDES[currentHeroSlide].title}
              </h1>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl font-normal">
                {HERO_SLIDES[currentHeroSlide].description}
              </p>

              {/* Prominent Verification Search Card */}
              <div className="bg-white p-2.5 sm:p-3 rounded-2xl shadow-floating text-slate-900 border border-slate-200/80 max-w-xl">
                <form onSubmit={handleHeroSearchSubmit} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Enter 32-byte Certificate ID or Proof Hash..."
                      value={heroSearchInput}
                      onChange={(e) => setHeroSearchInput(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 sm:py-3 text-xs sm:text-sm font-mono rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:bg-white text-slate-900 placeholder:text-slate-400 placeholder:font-sans"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 sm:py-3 rounded-xl bg-navy-900 text-white hover:bg-navy-800 font-bold text-sm shadow-md transition-all active:scale-[0.99] flex-shrink-0"
                  >
                    <span>Verify Now</span>
                    <ArrowRight size={16} />
                  </button>
                </form>
              </div>

              {/* Secondary Navigation Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => onNavigateToTab(HERO_SLIDES[currentHeroSlide].ctaPrimaryTab)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-azure-600 hover:bg-azure-700 text-white font-bold text-sm shadow transition-colors"
                >
                  <span>{HERO_SLIDES[currentHeroSlide].ctaPrimary}</span>
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => onNavigateToTab(HERO_SLIDES[currentHeroSlide].ctaSecondaryTab)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-800/90 hover:bg-navy-700 text-slate-200 border border-navy-600/70 font-semibold text-sm transition-colors"
                >
                  <span>{HERO_SLIDES[currentHeroSlide].ctaSecondary}</span>
                </button>
              </div>


            </div>

            {/* Right Column: Floating Mock Certificate Preview */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-md transform lg:rotate-1 hover:rotate-0 transition-transform duration-300">
                {/* Certificate Mock Card */}
                <div className="bg-white text-slate-900 rounded-2xl shadow-floating border-4 border-navy-950 p-6 relative overflow-hidden">
                  {/* Outer double border line */}
                  <div className="border border-gold-500/50 p-4 rounded-xl relative">
                    {/* Top Certificate Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center font-bold text-xs">
                          CC
                        </div>
                        <div>
                          <span className="font-extrabold text-navy-950 text-xs block">
                            CERTICHAIN REGISTRY
                          </span>
                          <span className="text-[10px] text-slate-500">Official Protocol Credential</span>
                        </div>
                      </div>
                      <StatusBadge status="valid" label="Valid" size="sm" />
                    </div>

                    {/* Certificate Body */}
                    <div className="text-center py-2 space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-azure-700">
                        Certificate of Achievement
                      </span>
                      <h3 className="font-serif font-bold text-lg text-navy-950">
                        Alice Nakamoto
                      </h3>
                      <p className="text-xs text-slate-600 px-2 line-clamp-2">
                        Master in Smart Contract Architecture & Zero-Exploit Verification Protocols
                      </p>
                    </div>

                    {/* Meta details */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-[10px]">
                      <div>
                        <span className="text-slate-400 block uppercase font-bold">Issuer</span>
                        <span className="font-semibold text-slate-800">Decentralized Consortium</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block uppercase font-bold">Issued Date</span>
                        <span className="font-semibold text-slate-800">2026-10-01</span>
                      </div>
                    </div>

                    {/* Proof Hash Footer */}
                    <div className="mt-3 pt-2 bg-slate-50 rounded-lg p-2 flex items-center justify-between text-[9px] font-mono text-slate-500 border border-slate-200/80">
                      <div className="flex items-center gap-1.5 truncate">
                        <Fingerprint size={12} className="text-emerald-600 flex-shrink-0" />
                        <span className="truncate">0x94b3db...2dd4</span>
                      </div>
                      <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                        On-Chain
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>

        {/* Bottom Caption Bar with Faded Merge */}
        <div className="mt-8 text-center text-xs text-slate-300/90 font-medium relative z-10">
          <div className="w-full max-w-xl mx-auto h-px bg-gradient-to-r from-transparent via-azure-400/25 to-transparent mb-3" />
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-navy-900/50 border border-navy-700/30 backdrop-blur-sm text-xs text-slate-300 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse flex-shrink-0" />
            <span>Tamper-proof credentials anchored on Ethereum and stored on IPFS.</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4.2 OVERLAPPING INFO CARDS (Latest Activity + 3-Column Quick Actions) */}
      {/* ========================================================================= */}
      <div className="relative z-20 -mt-10 sm:-mt-14 mb-12">
        <Container size="xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Card: Announcements / Activity (.card-navy) */}
            <div className="lg:col-span-4 bg-navy-950 text-white rounded-2xl p-6 shadow-navy-deep border border-navy-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-navy-800 mb-4">
                  <h3 className="font-bold text-base text-white tracking-wide flex items-center gap-2">
                    <ScrollText size={18} className="text-gold-400" />
                    <span>Latest Activity</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsActivityPlaying(!isActivityPlaying)}
                      className="text-slate-400 hover:text-white p-1"
                      aria-label="Pause activity feed"
                    >
                      {isActivityPlaying ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                    <span className="text-[11px] font-mono text-slate-400">
                      {activityIndex + 1}/{STATIC_ACTIVITY_FEED.length}
                    </span>
                  </div>
                </div>

                <div className="min-h-[90px]">
                  <span className="text-[11px] font-mono text-gold-400 font-semibold block mb-1">
                    {STATIC_ACTIVITY_FEED[activityIndex].date}
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed line-clamp-3">
                    {STATIC_ACTIVITY_FEED[activityIndex].title}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-navy-800/80 flex items-center justify-between">
                <button
                  onClick={() => onNavigateToVerify(STATIC_ACTIVITY_FEED[activityIndex].certId)}
                  className="text-xs font-bold text-gold-400 hover:text-gold-300 flex items-center gap-1 group"
                >
                  <span>Verify Record</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="flex items-center gap-1">
                  {STATIC_ACTIVITY_FEED.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivityIndex(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === activityIndex ? 'w-4 bg-gold-400' : 'w-1.5 bg-navy-700'
                      }`}
                      aria-label={`Go to activity ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right Card: 3-Column White Card (.card-floating) */}
            <div className="lg:col-span-8 bg-white text-slate-900 rounded-2xl p-6 shadow-floating border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Column 1: Verify */}
              <div className="flex flex-col justify-between pt-4 md:pt-0">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-azure-50 text-azure-700 flex items-center justify-center mb-3">
                    <ShieldCheck size={22} />
                  </div>
                  <h4 className="font-bold text-base text-navy-950 mb-1.5">Verify</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Check any credential authenticity instantly against on-chain records. Zero wallet needed.
                  </p>
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => onNavigateToTab('verify')}
                    className="text-xs font-bold text-azure-700 hover:text-navy-950 flex items-center gap-1 group"
                  >
                    <span>Open Verifier</span>
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Column 2: Issue */}
              <div className="flex flex-col justify-between pt-4 md:pt-0 md:pl-6">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-900 flex items-center justify-center mb-3">
                    <FileCheck size={22} />
                  </div>
                  <h4 className="font-bold text-base text-navy-950 mb-1.5">Issue</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Accredited institutions hash metadata, pin to IPFS, and mint immutable on-chain proofs.
                  </p>
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => onNavigateToTab('issue')}
                    className="text-xs font-bold text-azure-700 hover:text-navy-950 flex items-center gap-1 group"
                  >
                    <span>Issuer Portal</span>
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Column 3: My Certificates */}
              <div className="flex flex-col justify-between pt-4 md:pt-0 md:pl-6">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                    <Award size={22} />
                  </div>
                  <h4 className="font-bold text-base text-navy-950 mb-1.5">My Certificates</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Holders can view, share, and export official PDF/PNG certificates with embedded QR codes.
                  </p>
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => onNavigateToTab('recipient')}
                    className="text-xs font-bold text-azure-700 hover:text-navy-950 flex items-center gap-1 group"
                  >
                    <span>View Wallet</span>
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* ========================================================================= */}
      {/* 4.3 TRUST & "BUILT WITH" STRIP */}
      {/* ========================================================================= */}
      <div className="py-8 bg-slate-50 border-y border-slate-200/80">
        <Container size="lg">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">
            Built with open, verifiable technology
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 items-center justify-center text-slate-500 text-xs font-semibold">
            <div className="flex items-center justify-center gap-2 hover:text-navy-950 transition-colors">
              <Layers size={18} className="text-slate-700" />
              <span>Ethereum Sepolia</span>
            </div>
            <div className="flex items-center justify-center gap-2 hover:text-navy-950 transition-colors">
              <HardDrive size={18} className="text-slate-700" />
              <span>IPFS Storage</span>
            </div>
            <div className="flex items-center justify-center gap-2 hover:text-navy-950 transition-colors">
              <UploadCloud size={18} className="text-slate-700" />
              <span>Pinata Gateway</span>
            </div>
            <div className="flex items-center justify-center gap-2 hover:text-navy-950 transition-colors">
              <Wallet size={18} className="text-slate-700" />
              <span>MetaMask / Web3</span>
            </div>
            <div className="flex items-center justify-center gap-2 hover:text-navy-950 transition-colors col-span-2 sm:col-span-1">
              <Cpu size={18} className="text-slate-700" />
              <span>Solidity 0.8.24</span>
            </div>
          </div>
        </Container>
      </div>

      {/* ========================================================================= */}
      {/* 4.4 FEATURE VIDEO-STYLE PANEL (How It Works 4-Step Diagram) */}
      {/* ========================================================================= */}
      <Section variant="white" id="how-it-works">
        <Container size="xl">
          <div className="bg-navy-950 text-white rounded-3xl p-8 sm:p-12 lg:p-14 shadow-navy-deep border border-navy-800">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Left Column: Description & Intro */}
              <div className="lg:col-span-5 space-y-5">
                <span className="text-xs font-bold uppercase tracking-widest text-gold-400">
                  HOW IT WORKS
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  From issuance to verification in seconds
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Every certificate passes through an automated cryptographic pipeline ensuring privacy, decentralized persistence, and instant mathematical verification.
                </p>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={() => onNavigateToTab('verify')}
                    className="btn-primary bg-azure-600 hover:bg-azure-500"
                  >
                    <span>Test Verification</span>
                    <ArrowRight size={15} />
                  </button>
                  <button
                    onClick={() => setIsDiagramPlaying(!isDiagramPlaying)}
                    className="p-2.5 rounded-lg bg-navy-900 text-slate-300 hover:text-white border border-navy-700"
                    aria-label={isDiagramPlaying ? 'Pause animation' : 'Play animation'}
                  >
                    {isDiagramPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                </div>
              </div>

              {/* Right Column: 4-Step Diagram Media Frame */}
              <div className="lg:col-span-7">
                <div className="bg-navy-900/90 border border-navy-700 rounded-2xl p-6 shadow-inner">
                  {/* Step indicators */}
                  <div className="grid grid-cols-4 gap-2 mb-6">
                    {[
                      { num: '01', title: 'Hash' },
                      { num: '02', title: 'Pin' },
                      { num: '03', title: 'Anchor' },
                      { num: '04', title: 'Verify' },
                    ].map((step, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveStep(idx)}
                        className={`text-left p-2.5 rounded-xl border transition-all ${
                          idx === activeStep
                            ? 'bg-navy-800 border-gold-400 text-white shadow-md'
                            : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-[10px] font-mono block text-gold-400 font-bold">{step.num}</span>
                        <span className="text-xs font-bold">{step.title}</span>
                      </button>
                    ))}
                  </div>

                  {/* Active Step Display */}
                  <div className="bg-navy-950 rounded-xl p-6 border border-navy-800 min-h-[160px] flex flex-col justify-center">
                    {activeStep === 0 && (
                      <div className="space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 text-gold-400 text-sm font-bold">
                          <Fingerprint size={18} />
                          <span>Step 1: Client-Side SHA-256 Hashing</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          The certificate metadata JSON is canonicalized per RFC 8785 and hashed locally in your browser with zero data leakage to third parties.
                        </p>
                      </div>
                    )}
                    {activeStep === 1 && (
                      <div className="space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 text-azure-400 text-sm font-bold">
                          <UploadCloud size={18} />
                          <span>Step 2: IPFS Decentralized Pinning</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          The canonical JSON metadata is pinned securely via serverless proxy to IPFS, generating a permanent immutable Content Identifier (CID).
                        </p>
                      </div>
                    )}
                    {activeStep === 2 && (
                      <div className="space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                          <Database size={18} />
                          <span>Step 3: Ethereum Smart Contract Anchoring</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          The authorized issuer calls CertificateRegistry.sol on Ethereum Sepolia, creating a packed 4-slot on-chain record linked to the proof hash.
                        </p>
                      </div>
                    )}
                    {activeStep === 3 && (
                      <div className="space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 text-teal-300 text-sm font-bold">
                          <ShieldCheck size={18} />
                          <span>Step 4: Public Mathematical Verification</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Anyone can paste a Certificate ID or scan a QR code. The app recomputes the SHA-256 hash client-side and validates against on-chain state.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ========================================================================= */}
      {/* 4.5 MISSION / MESSAGE SECTION ("Why CertiChain?") */}
      {/* ========================================================================= */}
      <Section variant="slate" id="about">
        <Container size="xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column: Framed Seal Illustration Card */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-sm bg-white rounded-2xl p-6 border border-slate-200 shadow-card text-center space-y-4">
                <div className="w-28 h-28 mx-auto rounded-full bg-navy-50 border-4 border-navy-900 flex items-center justify-center text-navy-950 shadow-inner">
                  <svg viewBox="0 0 48 48" className="w-16 h-16 text-navy-900" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="24" cy="24" r="20" stroke="#0b1f4b" strokeWidth="2" fill="#f8fafc" />
                    <path d="M24 8 L28 18 L38 18 L30 24 L34 34 L24 28 L14 34 L18 24 L10 18 L20 18 Z" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-navy-950 text-base">Cryptographic Trust Anchor</h4>
                  <p className="text-xs text-slate-500 mt-1">Official Protocol Security Standard</p>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-center justify-around font-mono">
                  <span>SHA-256</span>
                  <span>•</span>
                  <span>EVM 0.8.24</span>
                  <span>•</span>
                  <span>RFC 8785</span>
                </div>
              </div>
            </div>

            {/* Right Column: Message & Details */}
            <div className="lg:col-span-7 space-y-5">
              <SectionTitle
                title="Why CertiChain?"
                kicker="PROTOCOL ARCHITECTURE"
                align="left"
              />

              <div className="border-l-4 border-navy-900 pl-4 py-1 text-slate-700 text-sm sm:text-base leading-relaxed italic bg-slate-100/60 rounded-r-lg">
                "Credential fraud undermines trust in higher education and professional licensing. CertiChain replaces slow manual checks with instantaneous, decentralized mathematical verification."
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                By combining OpenZeppelin v5 access-controlled smart contracts on Ethereum with decentralized IPFS metadata pinning, credentials issued on CertiChain cannot be altered, forged, or deleted by any central intermediary.
              </p>

              <div className="pt-2">
                <button
                  onClick={() => onNavigateToTab('verify')}
                  className="btn-primary"
                >
                  <span>Learn More About Verification</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ========================================================================= */}
      {/* 4.6 ROLE BADGES ROW */}
      {/* ========================================================================= */}
      <Section variant="white" aria-labelledby={roleTitleId}>
        <Container size="xl">
          <SectionTitle
            id={roleTitleId}
            title="Who Uses CertiChain?"
            subtitle="Built for the entire credential verification ecosystem"
            align="center"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 pt-4">
            {[
              { label: 'Institutions', desc: 'Universities & Boards', icon: Building2, tab: 'issue' as const },
              { label: 'Students', desc: 'Degree & Diploma Holders', icon: GraduationCap, tab: 'recipient' as const },
              { label: 'Employers', desc: 'Talent Verification', icon: Briefcase, tab: 'verify' as const },
              { label: 'Verifiers', desc: 'Public Background Checks', icon: ShieldCheck, tab: 'verify' as const },
              { label: 'Auditors', desc: 'Compliance & Governance', icon: Lock, tab: 'verify' as const },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  onClick={() => onNavigateToTab(item.tab)}
                  className="group flex flex-col items-center text-center p-4 rounded-2xl hover:bg-slate-50 transition-all duration-200 focus:outline-none"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white border-2 border-navy-900 group-hover:border-azure-600 group-hover:shadow-card-hover group-hover:-translate-y-1 transition-all duration-200 flex items-center justify-center text-navy-900 group-hover:text-azure-600 shadow-sm mb-3">
                    <Icon size={32} />
                  </div>
                  <span className="font-bold text-navy-950 text-sm sm:text-base group-hover:text-azure-700 transition-colors">
                    {item.label}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* ========================================================================= */}
      {/* 4.7 USE-CASE BENTO GRID */}
      {/* ========================================================================= */}
      <Section variant="slate" aria-labelledby={fitsTitleId}>
        <Container size="xl">
          <SectionTitle
            id={fitsTitleId}
            title="Where CertiChain Fits"
            subtitle="A versatile verification standard for educational, professional, and regulatory credentials"
            align="center"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-2">
            {/* Tile 1 (Large 2x2): Academic Degrees */}
            <div className="lg:col-span-2 lg:row-span-2 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-900 text-white rounded-2xl p-8 shadow-card flex flex-col justify-between relative overflow-hidden border border-navy-800">
              <div className="relative z-10 space-y-4">
                <span className="inline-block bg-gold-400/20 text-gold-300 border border-gold-400/40 px-3 py-1 rounded-full text-xs font-bold uppercase">
                  Verified On-Chain
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Higher Education Degrees & Transcripts
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed max-w-md">
                  Eliminate transcript fraud with cryptographic proof hashes tied directly to academic institution registrar contracts on EVM networks.
                </p>
              </div>

              <div className="relative z-10 pt-8 flex items-center justify-between">
                <button
                  onClick={() => onNavigateToTab('issue')}
                  className="btn-primary bg-white text-navy-950 hover:bg-slate-100"
                >
                  <span>Issue Degree Record</span>
                  <ArrowRight size={14} />
                </button>
                <GraduationCap size={64} className="text-navy-800" />
              </div>
            </div>

            {/* Tile 2: Course Completion */}
            <Card hoverable className="p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-azure-50 text-azure-700 flex items-center justify-center mb-3">
                  <BookOpen size={20} />
                </div>
                <h4 className="font-bold text-navy-950 text-base mb-1">Course Completion</h4>
                <p className="text-xs text-slate-600">
                  Bootcamps, online academies, and continuous professional development.
                </p>
              </div>
              <div className="pt-3">
                <ArrowLink onClick={() => onNavigateToTab('verify')}>Verify Course</ArrowLink>
              </div>
            </Card>

            {/* Tile 3: Internships */}
            <Card hoverable className="p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                  <Briefcase size={20} />
                </div>
                <h4 className="font-bold text-navy-950 text-base mb-1">Internship Certificates</h4>
                <p className="text-xs text-slate-600">
                  Verified corporate experience letters and practicum sign-offs.
                </p>
              </div>
              <div className="pt-3">
                <ArrowLink onClick={() => onNavigateToTab('verify')}>Inspect Record</ArrowLink>
              </div>
            </Card>

            {/* Tile 4: Professional Licenses */}
            <Card hoverable className="p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
                  <Lock size={20} />
                </div>
                <h4 className="font-bold text-navy-950 text-base mb-1">Professional Licenses</h4>
                <p className="text-xs text-slate-600">
                  Medical, legal, engineering, and security licenses with on-chain revocation support.
                </p>
              </div>
              <div className="pt-3">
                <ArrowLink onClick={() => onNavigateToTab('verify')}>Check Revocation</ArrowLink>
              </div>
            </Card>

            {/* Tile 5: Workshops & Hackathons */}
            <Card hoverable className="p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
                  <Award size={20} />
                </div>
                <h4 className="font-bold text-navy-950 text-base mb-1">Hackathon Honors</h4>
                <p className="text-xs text-slate-600">
                  Verifiable proof of project awards, placements, and hackathon bounties.
                </p>
              </div>
              <div className="pt-3">
                <ArrowLink onClick={() => onNavigateToTab('recipient')}>View Honors</ArrowLink>
              </div>
            </Card>
          </div>
        </Container>
      </Section>

      {/* ========================================================================= */}
      {/* 4.8 FINAL CALL-TO-ACTION BAND */}
      {/* ========================================================================= */}
      <div className="bg-navy-900 text-white py-12 border-t border-navy-800">
        <Container size="lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Ready to verify a blockchain credential?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Enter any 32-byte Certificate ID or scan a QR code to audit authenticity in real-time.
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('verify')}
              className="btn-primary bg-azure-600 hover:bg-azure-500 px-6 py-3 text-sm font-bold flex-shrink-0"
            >
              <span>Launch Verifier</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </Container>
      </div>
    </div>
  );
};
