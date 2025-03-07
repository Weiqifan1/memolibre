import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { GlobalStateService } from '../angular/shared/services/global-state-service';
import { FlashCard } from '../businesslogic/models/flashcard';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../card/card.component';
import { debounceTime } from 'rxjs/operators';
import { TooltipDirective } from '../tooltip.directive';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CardComponent, TooltipDirective],
  templateUrl: './search-page.component.html',
  styleUrls: ['./search-page.component.css'],
})
export class SearchPageComponent implements OnInit, OnDestroy {
  searchForm: FormGroup;
  matchingCards: FlashCard[] = [];
  matchingCount: number = 0;
  showTooltips: boolean = true;
  clearSearchButtonText: string = 'Clear Search'; // New property
  private subscription: Subscription = new Subscription();

  constructor(
    private fb: FormBuilder,
    private globalStateService: GlobalStateService
  ) {
    this.searchForm = this.fb.group({
      cardNumberSearch: [''],
      frontSideRegex: [''],
      backSideRegex: [''],
      tagsRegex: [''],
    });
  }

  ngOnInit(): void {
    const searchSettings = this.globalStateService.getState().searchSettings;
    this.searchForm.patchValue(searchSettings);

    this.globalStateService.state$.subscribe(state => {
      this.showTooltips = state.appSettings['showTooltips'] === 'true';
    });

    this.searchForm.valueChanges.pipe(debounceTime(300)).subscribe(values => {
      this.globalStateService.updateSearchSettings(values);
      this.performSearch();
    });

    this.performSearch();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  performSearch(): void {
    const deck = this.getDeck();
    if (!deck) {
      this.matchingCards = [];
      this.matchingCount = 0;
      return;
    }
    const criteria = this.searchForm.value;
    this.matchingCards = this.filterCards(deck.cards, criteria);
    this.matchingCount = this.matchingCards.length;
  }

  filterCards(cards: FlashCard[], criteria: any): FlashCard[] {
    const { cardNumberSearch, frontSideRegex, backSideRegex, tagsRegex } = criteria;

    let cardNumberCondition: (card: FlashCard) => boolean = () => true;
    if (cardNumberSearch) {
      const rangeMatch = cardNumberSearch.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          cardNumberCondition = card => card.cardNumber >= start && card.cardNumber <= end;
        }
      } else {
        const number = parseInt(cardNumberSearch, 10);
        if (!isNaN(number)) {
          cardNumberCondition = card => card.cardNumber === number;
        }
      }
    }

    let frontRegex: RegExp | null = null;
    let backRegex: RegExp | null = null;
    let tagRegex: RegExp | null = null;
    try {
      if (frontSideRegex) frontRegex = new RegExp(frontSideRegex);
      if (backSideRegex) backRegex = new RegExp(backSideRegex);
      if (tagsRegex) tagRegex = new RegExp(tagsRegex);
    } catch (e) {
      this.matchingCards = [];
      this.matchingCount = 0;
      return [];
    }

    return cards.filter(card =>
      cardNumberCondition(card) &&
      (!frontRegex || frontRegex.test(card.frontSide)) &&
      (!backRegex || backRegex.test(card.backSide)) &&
      (!tagRegex || card.tags.some(tag => tagRegex.test(tag)))
    );
  }

  clearSearchAndScrollToTop(): void {
    // Reset the search form
    this.searchForm.reset({
      cardNumberSearch: '',
      frontSideRegex: '',
      backSideRegex: '',
      tagsRegex: ''
    });

    // Scroll to the top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  public getDeck() {
    return this.globalStateService.getState().practiceSession.deck;
  }
}
