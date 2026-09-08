import React from 'react';
import { HelpItem, UserProfile } from '../types';
import { HeartHandshake, HelpCircle, MapPin, Coins, Trash2, CheckCircle, Clock } from 'lucide-react';

interface MyHelpSectionProps {
  items: HelpItem[];
  user: UserProfile | null;
  onSelectItem: (item: HelpItem) => void;
  onDeleteItem: (itemId: string) => void;
  onOpenCreate: () => void;
}

export const MyHelpSection: React.FC<MyHelpSectionProps> = ({
  items,
  user,
  onSelectItem,
  onDeleteItem,
  onOpenCreate,
}) => {
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Accedi a HELP con il tuo Nickname</h2>
        <p className="text-sm text-slate-600">Configura il tuo profilo per visualizzare e gestire i tuoi aiuti.</p>
      </div>
    );
  }

  // Filter items where user is owner or helper
  const myItems = items.filter((item) => item.userId === user.id || item.helperId === user.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-sans">I Miei Aiuti & Offerte</h1>
          <p className="text-xs text-slate-500 mt-0.5">Gestisci ciò che hai pubblicato o gli aiuti in cui sei coinvolto</p>
        </div>
        <button
          onClick={onOpenCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-1.5"
        >
          <span>+ Pubblica Nuovo Aiuto</span>
        </button>
      </div>

      {myItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl">
            📋
          </div>
          <h3 className="text-base font-bold text-slate-900">Non hai ancora pubblicato o accettato alcun aiuto</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Ricorda che per la civile convivenza di HELP, chi si mette a disposizione per gli altri riceve supporto e crediti!
          </p>
          <div className="pt-2">
            <button
              onClick={onOpenCreate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs"
            >
              Pubblica il primo aiuto
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myItems.map((item) => {
            const isOwner = item.userId === user.id;
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between"
              >
                <div className="space-y-3 cursor-pointer" onClick={() => onSelectItem(item)}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                      item.type === 'offer' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isOwner ? (item.type === 'offer' ? 'La mia offerta' : 'La mia richiesta') : 'Aiuto in cui collabori'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      item.status === 'active' ? 'bg-amber-50 text-amber-800' :
                      item.status === 'in_progress' ? 'bg-emerald-50 text-emerald-800 animate-pulse' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {item.status === 'active' && 'Disponibile'}
                      {item.status === 'in_progress' && 'In corso'}
                      {item.status === 'completed' && 'Completato'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 line-clamp-1">{item.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2">{item.description}</p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-amber-600 font-bold flex items-center space-x-1">
                    <Coins className="w-3.5 h-3.5" />
                    <span>{item.isFree ? 'Gratis' : `${item.creditsRequired} Crediti`}</span>
                  </div>

                  {isOwner && item.status === 'active' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(item.id);
                      }}
                      className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                      title="Elimina annuncio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
