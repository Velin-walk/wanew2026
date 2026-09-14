import React, { useState } from 'react';
import { ChevronRight, ArrowLeft, Camera, CheckSquare, HeartPulse, Backpack } from 'lucide-react';

export const TrekTipsContent: React.FC = () => {
  const [activeSubPage, setActiveSubPage] = useState<string | null>(null);

  if (activeSubPage === 'preparation') return <PreparationGuide onBack={() => setActiveSubPage(null)} />;
  if (activeSubPage === 'creator') return <CreatorGuide onBack={() => setActiveSubPage(null)} />;
  if (activeSubPage === 'packing') return <PackingList onBack={() => setActiveSubPage(null)} />;
  if (activeSubPage === 'quiz') return <PreparednessQuiz onBack={() => setActiveSubPage(null)} />;

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="border-b border-[#F0EBE5] pb-3">
        <h3 className="text-lg font-extrabold text-[#1F1F1F]">Trek Tips & Packing</h3>
        <p className="text-xs text-[#8B8680] mt-0.5">Everything you need to prepare for a successful Himalayan journey.</p>
      </div>

      <div className="space-y-3">
        <button onClick={() => setActiveSubPage('preparation')} className="w-full p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] flex items-center justify-between group hover:border-[#7ABA42] transition-colors text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#1F1F1F] group-hover:text-[#7ABA42] transition-colors">Preparation Guide</h4>
              <p className="text-xs text-[#5A5551] mt-0.5">Before the trek, packing smart, weather, and physical readiness.</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#8B8680] group-hover:text-[#7ABA42] transition-colors" />
        </button>

        <button onClick={() => setActiveSubPage('packing')} className="w-full p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] flex items-center justify-between group hover:border-[#7ABA42] transition-colors text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#7ABA42] flex items-center justify-center shrink-0">
              <Backpack className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#1F1F1F] group-hover:text-[#7ABA42] transition-colors">Trek Essentials Reference</h4>
              <p className="text-xs text-[#5A5551] mt-0.5">Detailed packing list for clothing, toiletries, and equipment.</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#8B8680] group-hover:text-[#7ABA42] transition-colors" />
        </button>

        <button onClick={() => setActiveSubPage('creator')} className="w-full p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] flex items-center justify-between group hover:border-[#7ABA42] transition-colors text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 text-[#E08828] flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#1F1F1F] group-hover:text-[#7ABA42] transition-colors">Creator Guide</h4>
              <p className="text-xs text-[#5A5551] mt-0.5">Tips for better photos, videos, and collaboration guidelines.</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#8B8680] group-hover:text-[#7ABA42] transition-colors" />
        </button>

        <button onClick={() => setActiveSubPage('quiz')} className="w-full p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] flex items-center justify-between group hover:border-[#7ABA42] transition-colors text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#1F1F1F] group-hover:text-[#7ABA42] transition-colors">Trekking Preparedness Quiz</h4>
              <p className="text-xs text-[#5A5551] mt-0.5">Assess your mental and physical readiness before hitting the trail.</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#8B8680] group-hover:text-[#7ABA42] transition-colors" />
        </button>
      </div>
    </div>
  );
};

const PreparationGuide: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="space-y-5 animate-in slide-in-from-right-4 duration-200">
    <div className="flex items-center gap-3 border-b border-[#F0EBE5] pb-3">
      <button onClick={onBack} className="p-1.5 rounded-full hover:bg-[#F9F7F5] transition-colors text-[#5A5551]">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div>
        <h3 className="text-lg font-extrabold text-[#1F1F1F]">Preparation Guide</h3>
        <p className="text-xs text-[#8B8680] mt-0.5">Thank You for Choosing to Trek with Walk Nepal Walk!</p>
      </div>
    </div>
    
    <div className="space-y-4 text-xs text-[#5A5551] leading-relaxed">
      <p>We're excited to have you join our upcoming trek. Here are some suggestions to help you prepare well and make your journey more enjoyable.</p>

      <div className="space-y-2">
        <h4 className="font-bold text-sm text-[#1F1F1F]">Before the Trek</h4>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong className="text-[#1F1F1F]">Confirm the Trek Dates:</strong> Please note the trek dates and manage your personal tasks accordingly so you can travel without stress.</li>
          <li><strong className="text-[#1F1F1F]">Know Your Route:</strong> Take a few minutes to learn about the trail - the terrain, altitude, villages, lakes, and mountains you'll see along the way. It helps you stay more connected during the trek.</li>
        </ul>
      </div>

      <div className="space-y-2">
        <h4 className="font-bold text-sm text-[#1F1F1F]">Packing Smart</h4>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong className="text-[#1F1F1F]">Test Before You Trek:</strong> Pack your bag early and try carrying it on a short walk or hike. This helps you check its fit, comfort, and weight balance.</li>
          <li><strong className="text-[#1F1F1F]">Keep It Light:</strong> The ideal backpack weight is around or under 5 kg. Even half a kilo extra can feel heavy on the trail, so carry only essentials.</li>
          <li><strong className="text-[#1F1F1F]">Avoid Last-Minute Packing:</strong> Testing your gear in advance gives you time to make changes if something doesn't feel right.</li>
          <li><strong className="text-[#1F1F1F]">Test New Gear:</strong> If you've bought new shoes, bags, or pants, wear them on a few short walks before the trek. It's better to find out early if something is uncomfortable.</li>
        </ul>
      </div>

      <div className="space-y-2">
        <h4 className="font-bold text-sm text-[#1F1F1F]">Weather and Preparation</h4>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong className="text-[#1F1F1F]">Check the Weather:</strong> Look up the weather forecast for both the trek region and your travel route. This helps you plan clothing and timing.</li>
          <li><strong className="text-[#1F1F1F]">Be Ready for Changes:</strong> Mountain weather can shift quickly. A light rain cover and warm layers can make a big difference.</li>
        </ul>
      </div>

      <div className="space-y-2">
        <h4 className="font-bold text-sm text-[#1F1F1F]">Physical Readiness</h4>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong className="text-[#1F1F1F]">Practice Hikes:</strong> Go for short hikes with your backpack packed as you plan for the trek. It will help build stamina and give you a realistic idea of the weight you'll be carrying.</li>
          <li><strong className="text-[#1F1F1F]">Hydrate Well:</strong> Start drinking enough water a few days before the trek. Staying hydrated helps with energy and altitude adjustment.</li>
          <li><strong className="text-[#1F1F1F]">Sleep and Rest:</strong> Get enough sleep in the days leading up to the trek. A well-rested body adjusts faster and performs better.</li>
          <li><strong className="text-[#1F1F1F]">Acclimatize Slowly:</strong> If your trek goes to higher altitudes, take it easy and give your body time to adjust.</li>
        </ul>
      </div>

      <div className="space-y-2">
        <h4 className="font-bold text-sm text-[#1F1F1F]">Safety and Essentials</h4>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong className="text-[#1F1F1F]">Know the Guidelines:</strong> Please go through our FAQ, Safety & Policy if you haven't already.</li>
          <li><strong className="text-[#1F1F1F]">Carry Important Documents:</strong> Keep your ID, permits, and some cash in a waterproof pouch.</li>
          <li><strong className="text-[#1F1F1F]">Stay Connected:</strong> Save our contact details and the trek leader's number on your phone.</li>
        </ul>
      </div>

      <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 mt-4">
        <h4 className="font-bold text-sm mb-2">Final Note</h4>
        <p>You can go through our "Trekking Preparedness Quiz" just for fun - not to overthink, but to get a feel of your readiness.</p>
        <p className="mt-2 font-semibold">We can't wait to walk these trails with you. See you on the mountains - light, ready, and smiling.</p>
        <p className="mt-1 italic">- Team Walk Nepal Walk</p>
      </div>
    </div>
  </div>
);

const CreatorGuide: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="space-y-5 animate-in slide-in-from-right-4 duration-200">
    <div className="flex items-center gap-3 border-b border-[#F0EBE5] pb-3">
      <button onClick={onBack} className="p-1.5 rounded-full hover:bg-[#F9F7F5] transition-colors text-[#5A5551]">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div>
        <h3 className="text-lg font-extrabold text-[#1F1F1F]">Creator Guide</h3>
        <p className="text-xs text-[#8B8680] mt-0.5">Help us & yourself create beautiful memories together.</p>
      </div>
    </div>

    <div className="space-y-5 text-xs text-[#5A5551] leading-relaxed">
      <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl text-orange-900">
        <em>*Collaboration requests shall be accepted on the basis of quality of the content please!</em>
      </div>

      <div className="space-y-3">
        <h4 className="font-bold text-sm text-[#1F1F1F] uppercase tracking-wider text-[#E08828]">Before The Hike: Tips for Better Photos & Videos</h4>
        
        <div className="space-y-3">
          <div>
            <strong className="text-[#1F1F1F]">1. Angle, Composition and shot selection is king</strong>
            <p>Camera gears and quality of the device is secondary to good photographic knowledge. Watch some easy tutorials on youtube. They enhance your photographic sense instantly.</p>
            <ul className="list-disc pl-4 mt-1">
              <li>"Never ignore low quality videos".</li>
              <li>Instagram compresses the quality anyway.</li>
              <li>Color and Lights can be edited after the shots are taken.</li>
            </ul>
          </div>
          <div>
            <strong className="text-[#1F1F1F]">2. Shoot Vertical (Important!)</strong>
            <p>Use portrait mode (9:16) for videos. Perfect for Instagram reels.</p>
          </div>
          <div>
            <strong className="text-[#1F1F1F]">3. Capture These Moments</strong>
            <p>Try to record:</p>
            <ul className="list-disc pl-4 mt-1">
              <li>Starting excitement, Walking shots, Group laughter</li>
              <li>Scenic landscapes, Rest stops, Trail details (feet, signs, bridges, flowers)</li>
              <li>Mountain reveals, Personal reactions, Finish celebration</li>
              <li>Even the journey starting from home and ending at home.</li>
            </ul>
          </div>
          <div>
            <strong className="text-[#1F1F1F]">4. Keep Clips Short</strong>
            <p>Take 5-10 second clips instead of long shaky videos. Long videos only when the situation story demands or the context is extended.</p>
          </div>
          <div>
            <strong className="text-[#1F1F1F]">5. Move Slowly</strong>
            <p>Slow pan = cinematic. Avoid fast swinging camera movement. Even better if you take non pan shots and compile aesthetic moments.</p>
          </div>
          <div>
            <strong className="text-[#1F1F1F]">6. Include People</strong>
            <p>Nature is beautiful-people enjoying it makes it better. Always make people feel comfortable in camera. Forced shots violate our policy.</p>
          </div>
          <div>
            <strong className="text-[#1F1F1F]">7. Natural Smiles {'>'} Posed Photos</strong>
            <p>Candid moments feel more authentic.</p>
          </div>
          <div>
            <strong className="text-[#1F1F1F]">8. Try Different Angles</strong>
            <p>Low angle, side angle, wide shots, selfie clips.</p>
          </div>
          <div>
            <strong className="text-[#1F1F1F]">9. Avoid Too Much Zoom</strong>
            <p>Zoom lowers quality. Move closer instead.</p>
          </div>
          <div>
            <strong className="text-[#1F1F1F]">10. Enjoy the Hike First</strong>
            <p>Don't spend the whole day behind the camera.</p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[#F9F7F5] border border-[#E5E1DB]">
        <h4 className="font-bold text-sm text-[#1F1F1F] mb-2">Bonus Tip for Pro-Level Reels</h4>
        <p><strong className="text-[#1F1F1F]">For story telling:</strong> Write the script beforehand or make your mind up to share the story as the hike progress. Voiceover later or on the go. Plan the shots beforehand like - feets in motion, moving leafs, smiling faces, peaceful gazes. This way you have a plan to execute rather than just taking multiple senseless shots.</p>
        <p className="mt-2"><strong className="text-[#1F1F1F]">For Trendy Reels:</strong> Research the trending reels/tiktoks beforehand. Think of the possible improvements. Save those reels offline so you can share the idea with other friends precisely. Rehearse the execution. If there are multiple shots to be taken, note them so that you wont forget later to capture.</p>
        <ul className="list-disc pl-4 mt-2">
          <li>The most creative is the most personal.</li>
          <li>Embarrassment is less explored emotion, go out and feel free to embarrass yourself.</li>
        </ul>
      </div>

      <div className="space-y-3 pt-2">
        <h4 className="font-bold text-sm text-[#1F1F1F] uppercase tracking-wider text-[#7ABA42]">After The Hike: Collaboration Post Criteria</h4>
        <p>To be featured / collaborated by Walk Nepal Walk:</p>
        <ul className="space-y-2">
          <li><strong className="text-[#1F1F1F]">1. Post Within 3 Days:</strong> Fresh memories perform better.</li>
          <li><strong className="text-[#1F1F1F]">2. Tag Us:</strong> Tag @walknepalwalk</li>
          <li><strong className="text-[#1F1F1F]">3. Add Collaboration Invite:</strong> Invite Walk Nepal Walk as collaborator.</li>
          <li><strong className="text-[#1F1F1F]">4. Mention the Trail Name:</strong> Example: Sankhu-Kalamasi with Walk Nepal Walk</li>
          <li><strong className="text-[#1F1F1F]">5. Use Good Quality Media:</strong> Clear photos/videos only. For photos, limit number under 10. Rather than mixing bad shots and extending photo limits to 20, just select the best 10 photos and post. They perform much better with algorithms.</li>
          <li><strong className="text-[#1F1F1F]">6. Avoid Excessive Filters:</strong> Natural colors preferred. Slight edits brings out the best in photo videos but Overediting ruins the shots, so if you are not sure about edits keep it simple.</li>
          <li><strong className="text-[#1F1F1F]">7. Tell Your Experience:</strong> Even one short genuine caption helps. Example: "Unexpectedly beautiful trail and amazing company!"</li>
          <li><strong className="text-[#1F1F1F]">8. Reel Preferred:</strong> Reels usually get better reach than photo posts.</li>
          <li><strong className="text-[#1F1F1F]">9. Respectful & Positive Content:</strong> No offensive captions/music.</li>
          <li><strong className="text-[#1F1F1F]">10. Bonus Visibility for Exceptional Content:</strong> Creative storytelling, beautiful edits, or unique perspectives may be reshared on our main page.</li>
        </ul>
      </div>
    </div>
  </div>
);

const PackingList: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const categories = [
    {
      name: "Clothing",
      items: [
        { item: "Thermal Wears (Full Body)", qty: "1 set", notes: "" },
        { item: "Quick Dry Hiking T-Shirts", qty: "2 pcs", notes: "" },
        { item: "Trekking Trousers", qty: "1 pcs", notes: "" },
        { item: "Windproof Jackets", qty: "1 pcs", notes: "" },
        { item: "Down Jackets", qty: "1 pcs", notes: "" },
        { item: "Sun Hat & Warm Hat", qty: "1 each", notes: "" },
        { item: "Gloves", qty: "1 pair", notes: "" },
        { item: "Rain Coat", qty: "1 pcs", notes: "Compulsory Monsoon" },
        { item: "Undergarments", qty: "1 pair", notes: "" },
        { item: "Cotton Socks", qty: "2 pairs", notes: "" },
        { item: "Trekking Shoes", qty: "1 pair", notes: "If rocky terrain." },
        { item: "Light Sports Shoes", qty: "1 pair", notes: "If running or speed walking. Avoid during rain, it gets too loose and sturdiness is lost." },
        { item: "Slippers", qty: "1 pair", notes: "For Hotel Stay" },
      ]
    },
    {
      name: "Toiletries",
      items: [
        { item: "Face Towel", qty: "1 pcs", notes: "" },
        { item: "Toothbrush & Paste", qty: "1 each", notes: "" },
        { item: "Sun screen", qty: "1 pcs", notes: "" },
        { item: "Deodorant", qty: "1 pcs", notes: "" },
        { item: "Toilet Roll", qty: "1 roll", notes: "" },
        { item: "Face Wash", qty: "1 pcs", notes: "" },
      ]
    },
    {
      name: "Equipment & Extras",
      items: [
        { item: "Trekking Bag", qty: "1 pcs", notes: "" },
        { item: "Trekking Poles", qty: "1 pair", notes: "Must for long walks and steep uphill downhill trails." },
        { item: "Torch Light (Head)", qty: "1 pcs", notes: "Compulsory for Night Walk" },
        { item: "Personal First Aid Kit", qty: "1 set", notes: "" },
        { item: "Sun Glasses", qty: "1 pcs", notes: "" },
        { item: "Gaiters", qty: "1 pair", notes: "For snowy and slippery trails." },
        { item: "Mobile Chargers", qty: "1 pcs", notes: "As per your requirements" },
        { item: "Power Bank", qty: "1 pcs", notes: "As per your requirements" },
      ]
    }
  ];

  return (
    <div className="space-y-5 animate-in slide-in-from-right-4 duration-200">
      <div className="flex items-center gap-3 border-b border-[#F0EBE5] pb-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-[#F9F7F5] transition-colors text-[#5A5551]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-lg font-extrabold text-[#1F1F1F]">Trek Essentials</h3>
          <p className="text-xs text-[#8B8680] mt-0.5">*Reference only, you shall determine needs on your own please.</p>
        </div>
      </div>

      <div className="space-y-6">
        {categories.map((cat, idx) => (
          <div key={idx} className="space-y-3">
            <h4 className="font-bold text-sm text-[#1F1F1F] uppercase tracking-wider border-b border-[#F0EBE5] pb-1">{cat.name}</h4>
            <div className="grid grid-cols-1 gap-2">
              {cat.items.map((i, iIdx) => (
                <div key={iIdx} className="flex justify-between items-start p-2.5 rounded-xl bg-[#F9F7F5] border border-[#E5E1DB] text-xs">
                  <div className="font-semibold text-[#1F1F1F] w-1/2">{i.item}</div>
                  <div className="text-[#7ABA42] font-medium w-1/6 text-center">{i.qty}</div>
                  <div className="text-[#8B8680] w-1/3 text-right text-[11px] leading-tight">{i.notes}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="space-y-3 pt-2">
          <h4 className="font-bold text-sm text-[#1F1F1F] uppercase tracking-wider border-b border-[#F0EBE5] pb-1">Recommendations</h4>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 space-y-2 text-xs text-blue-900">
            <p><strong className="block mb-1">Rain caution:</strong> Backup clothes in case rain gets you wet during monsoon. Carry quality rain coats not just single use raincoats. Note that you need to cover bag and body together so large size raincoats needed for big bags.</p>
            <p><strong className="block mb-1">Leech prevention:</strong> Salt, Sanitizer, Long Socks, Long Trousers, Moov spray, Insecticides.</p>
            <p><strong className="block mb-1">Mosquito prevention:</strong> Odomos or similar repellents.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const PreparednessQuiz: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [showResult, setShowResult] = useState(false);

  const categories = [
    {
      id: "mental",
      title: "Mental Preparedness",
      questions: [
        { id: "m1", q: "Why do I want to do this trek — adventure, challenge, solitude, connection with nature?" },
        { id: "m2", q: "Am I mentally prepared for discomfort, setbacks, or unexpected changes (weather, delays, injuries)?" },
        { id: "m3", q: "How do I cope with stress or fear in high-stakes situations?" },
        { id: "m4", q: "Am I comfortable being disconnected from my digital life for extended periods?" },
        { id: "m5", q: "What expectations am I bringing to this trek — and are they flexible?" },
        { id: "m6", q: "Can I manage my emotions and reactions in a group or high-pressure environment?" },
        { id: "m7", q: "Am I open to learning from the experience, rather than trying to control it?" },
      ]
    },
    {
      id: "physical",
      title: "Physical Preparedness",
      questions: [
        { id: "p1", q: "Have I trained for the expected terrain, distance, and altitude of the trek?" },
        { id: "p2", q: "Can I carry my own load for the duration (if applicable), including water, gear, and food?" },
        { id: "p3", q: "Do I have any medical conditions that might need monitoring or special care on the trek?" },
        { id: "p4", q: "Am I acclimatized to the elevation, or have I planned time for it?" },
        { id: "p5", q: "Do I have experience with long-duration exertion in backcountry or wilderness areas?" },
        { id: "p6", q: "Have I tested all essential gear (especially boots and backpack) in real conditions?" },
        { id: "p7", q: "Do I know basic first aid and how to treat common injuries (blisters, sprains, dehydration)?" },
        { id: "p8", q: "Is my nutrition and hydration plan realistic and sufficient?" },
      ]
    },
    {
      id: "social",
      title: "Group & Social Awareness",
      questions: [
        { id: "s1", q: "Am I a team player, or do I tend to prioritize my own pace and preferences?" },
        { id: "s2", q: "Can I communicate clearly and respectfully, even when tired or frustrated?" },
        { id: "s3", q: "How do I respond to slower or less experienced group members — with patience or irritation?" },
        { id: "s4", q: "Am I willing to take on group responsibilities (cooking, navigating, supporting others)?" },
        { id: "s5", q: "Do I know how to handle disagreements or conflicts constructively in group settings?" },
        { id: "s6", q: "Am I ready to respect the authority and decisions of guides or trek leaders?" },
        { id: "s7", q: "Do I understand the importance of group safety over individual goals?" },
        { id: "s8", q: "Would I be willing to change plans for the good of the group or someone’s safety?" },
      ]
    },
    {
      id: "nature",
      title: "Nature & Cultural Respect",
      questions: [
        { id: "n1", q: "Do I understand and practice Leave No Trace principles?" },
        { id: "n2", q: "Am I prepared to minimize my impact on the environment (e.g., waste, fire, water sources)?" },
        { id: "n3", q: "Do I understand the local customs, beliefs, and sensitivities of the region I’m trekking in?" },
        { id: "n4", q: "Am I willing to dress, behave, and interact respectfully in culturally significant areas?" },
        { id: "n5", q: "Have I learned a few words or gestures in the local language to show respect?" },
        { id: "n6", q: "Do I know how to behave in sacred spaces (temples, shrines, ancestral lands)?" },
        { id: "n7", q: "Am I aware of my privilege as a traveler and avoiding a “conqueror” or extractive mindset?" },
        { id: "n8", q: "Am I choosing a trekking company or guide service that supports local communities and ethical tourism?" },
      ]
    }
  ];

  const handleSliderChange = (id: string, val: number) => {
    setScores(prev => ({ ...prev, [id]: val }));
  };

  const calculateResult = () => {
    let total = 0;
    const allQuestions = categories.flatMap(c => c.questions);
    allQuestions.forEach(q => {
      total += scores[q.id] || 3;
    });
    
    const percentage = Math.round((total / (allQuestions.length * 5)) * 100);
    setShowResult(true);
    return percentage;
  };

  return (
    <div className="space-y-5 animate-in slide-in-from-right-4 duration-200 pb-10">
      <div className="flex items-center gap-3 border-b border-[#F0EBE5] pb-3 sticky top-0 bg-white z-10 pt-2">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-[#F9F7F5] transition-colors text-[#5A5551]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-lg font-extrabold text-[#1F1F1F]">Preparedness Quiz</h3>
          <p className="text-xs text-[#8B8680] mt-0.5">Rate yourself from 1 to 5.</p>
        </div>
      </div>

      {!showResult ? (
        <div className="space-y-6">
          {categories.map(cat => (
            <div key={cat.id} className="space-y-3">
              <h4 className="font-bold text-sm text-[#1F1F1F] bg-[#F9F7F5] p-3 rounded-xl border border-[#E5E1DB]">{cat.title}</h4>
              <div className="space-y-4 px-2">
                {cat.questions.map(q => {
                  const val = scores[q.id] || 3;
                  return (
                    <div key={q.id} className="space-y-2">
                      <p className="text-xs text-[#5A5551] font-medium leading-relaxed">{q.q}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-[#8B8680] w-4 text-center">1</span>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={val}
                          onChange={(e) => handleSliderChange(q.id, parseInt(e.target.value))}
                          className="flex-1 h-1.5 bg-[#E5E1DB] rounded-lg appearance-none cursor-pointer accent-[#7ABA42]"
                        />
                        <span className="text-[10px] text-[#8B8680] w-4 text-center">5</span>
                        <span className="text-xs font-bold text-[#7ABA42] w-8 text-right">{val}/5</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            onClick={calculateResult}
            className="w-full mt-8 py-3.5 bg-[#ffb703] hover:bg-[#fb8500] text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-98"
          >
            Finish & See My Preparedness
          </button>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] text-center space-y-4 animate-in zoom-in-95 duration-200">
          <div className="text-4xl font-black text-[#7ABA42] mb-2">{calculateResult()}%</div>
          <h3 className="text-lg font-bold text-[#1F1F1F]">
            {calculateResult() >= 80 ? "Excellent! You're trek-ready!" : 
             calculateResult() >= 50 ? "You're somewhat ready, some prep needed." : 
             "More preparation required before your trek."}
          </h3>
          <p className="text-xs text-[#5A5551]">
            Remember, preparation is key to a safe and enjoyable journey in the mountains.
          </p>
          <button
            onClick={() => {
              setScores({});
              setShowResult(false);
            }}
            className="mt-4 px-6 py-2.5 bg-white border border-[#E5E1DB] text-[#5A5551] hover:bg-[#F0EBE5] rounded-xl text-xs font-bold transition-all"
          >
            Retake Quiz
          </button>
        </div>
      )}
    </div>
  );
};
