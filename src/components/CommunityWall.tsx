import React from 'react';
import { HeartHandshake, Award, ShieldCheck, Trophy, Sparkles, MessageCircle } from 'lucide-react';

export const CommunityWall: React.FC = () => {
  const topHelpers = [
    { rank: 1, nickname: 'MarcoSolidale', helped: 24, credits: 45, rating: 5.0 },
    { rank: 2, nickname: 'ElenaVicina', helped: 19, credits: 38, rating: 4.9 },
    { rank: 3, nickname: 'Giuseppe_Mi', helped: 15, credits: 30, rating: 4.8 },
    { rank: 4, nickname: 'SaraAiuta', helped: 12, credits: 24, rating: 4.9 },
    { rank: 5, nickname: 'Luca_Civico', helped: 10, credits: 20, rating: 4.7 },
  ];

  const stories = [
    {
      id: '1',
      title: 'Spesa consegnata con il sorriso in Zona Porta Romana',
      content: 'Grazie a Marco che si è messo a disposizione sulla piattaforma HELP, la signora Anna ha ricevuto la spesa pesante senza dover uscire con la pioggia. La civile convivenza passa da piccoli gesti quotidiani!',
      helper: 'MarcoSolidale',
      recipient: 'Signora Anna',
      date: 'Oggi',
    },
    {
      id: '2',
      title: 'Riparazione bicicletta in cortile',
      content: 'Un guasto improvviso al cambio della bici risolto in 15 minuti grazie agli attrezzi condivisi da Giuseppe. Nessuna registrazione, solo mutuo soccorso e rispetto reciproco.',
      helper: 'Giuseppe_Mi',
      recipient: 'Davide',
      date: 'Ieri',
    },
    {
      id: '3',
      title: 'Configurazione SPID e App Pubbliche',
      content: 'Elena ha aiutato un vicino a sbloccare lo SPID sul cellulare. Un aiuto digitale che ha evitato ore di attesa agli uffici. Grandissima community HELP!',
      helper: 'ElenaVicina',
      recipient: 'Matteo',
      date: '3 giorni fa',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center space-x-2 bg-emerald-600/60 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>La Civile Convivenza a 360 Gradi</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-sans">
            Bacheca Civica & Storie di Aiuto
          </h1>
          <p className="text-emerald-100 text-sm leading-relaxed">
            "Solo chi aiuta può essere aiutato." Scopri le storie di solidarietà nel tuo quartiere e i cittadini più attivi che rendono la nostra comunità un posto migliore.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Stories list */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            <span>Storie di Solidarietà Recente</span>
          </h2>

          <div className="space-y-4">
            {stories.map((story) => (
              <div key={story.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">Storie dal Vicinato</span>
                  <span>{story.date}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{story.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{story.content}</p>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div>Aiutante: <strong className="text-slate-800">{story.helper}</strong></div>
                  <div>Ricevente: <strong className="text-slate-800">{story.recipient}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>Classifica Aiutanti</span>
              </h3>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">Top Quartiere</span>
            </div>

            <div className="space-y-3">
              {topHelpers.map((item) => (
                <div key={item.rank} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      item.rank === 1 ? 'bg-amber-400 text-white' :
                      item.rank === 2 ? 'bg-slate-300 text-slate-800' :
                      item.rank === 3 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {item.rank}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{item.nickname}</div>
                      <div className="text-[10px] text-slate-500">{item.helped} aiuti completati</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-amber-600">{item.credits} 🪙</div>
                    <div className="text-[10px] text-slate-400">{item.rating} ⭐</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-900 leading-relaxed border border-emerald-100">
              💡 <strong>Come salire in classifica?</strong> Pubblica offerte di aiuto, rispondi alle esigenze dei vicini e guadagna crediti completando le attività.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
