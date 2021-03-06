
import * as _ from 'lodash';

import { Component, Input, Output, EventEmitter, Renderer, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { ModalController, AlertController, NavParams, ViewController } from 'ionic-angular';

import { InventoryManagerComponent } from '../pages/inventory/management/inventory.management';

import { StockItemService } from '../services/stockitem.service';
import { StockItem } from '../models/stockitem';

@Component({
  selector: 'omni-search',
  providers: [StockItemService],
  template: `
    <form (submit)="doSearch()">
      <ion-searchbar [(ngModel)]="searchQuery"
                     [ngModelOptions]="{standalone: true}"
                     [showCancelButton]="true"
                     placeholder="Search items"
                     animated="true"
                     debounce="0"
                     (ionCancel)="cancelSearch()"
                     (ionInput)="handleIonChange($event)"></ion-searchbar>
    </form>
`,
})
export class OmnisearchComponent implements OnInit, OnDestroy {
  private searchItems: StockItem[] = [];
  private globalListenKeypressRemover: Function;
  private inputElement: any;
  public searchQuery: string = '';

  @Output() searchResults = new EventEmitter();
  @Output() hasQuery = new EventEmitter();
  @Output() singleSearchItemResult = new EventEmitter();

  @Input() useSearchWindow: true;
  @Input() autofocus: boolean;
  @Input() offerToAdd: boolean;
  @Input() allowTemporaryAdd: boolean;
  @Input() ignoreModalInput: boolean;
  @Input() preventEnterClear: boolean;
  @Input() cancelWatcher: EventEmitter<any>;

  constructor(private itemService: StockItemService,
              private modalCtrl: ModalController,
              private alertCtrl: AlertController,
              private element: ElementRef,
              private renderer: Renderer) {}

  ngOnInit() {
    this.inputElement = this.element.nativeElement.querySelector('ion-searchbar input');

    if(this.autofocus) {
      this.inputElement.focus();
    }

    this.globalListenKeypressRemover = this.renderer.listenGlobal('document', 'keypress', ($event) => {
      if(this.ignoreModalInput && this.checkIfModalOnPage()) {
        return;
      }

      // don't hijack other inputs that might be visible
      if($event.srcElement && _.includes(['text', 'number', 'textarea', 'search'], $event.srcElement.type)) {
        return;
      }

      $event.global = true;
      this.handleQuery($event);
    });

    if(this.cancelWatcher) {
      this.cancelWatcher.subscribe(() => {
        this.cancelSearch();
      });
    }
  }

  doSearch() {
    this._itemSearch(this.searchQuery, true, (items) => {
      return new Promise(resolve => {
        if(items.length > 1) { return resolve(items); }
        if(items.length === 0 && this.offerToAdd) {
          this.offerToAddItem(this.searchQuery)
            .then(item => {
              if(!item) {
                this.cancelSearch();
                return resolve([]);
              }
              resolve([item]);
            });
        } else {
          resolve(items);
        }

        if(!this.preventEnterClear) {
          this.cancelSearch();
        }
      });
    });
  }

  offerToAddItem(query: string): Promise<StockItem> {
    return new Promise(resolve => {
      const buttons = [
        {
          text: 'Yes',
          handler: () => {
            let modal = this.modalCtrl.create(InventoryManagerComponent, {
              stockItem: new StockItem({ name: '', sku: query, taxable: false, cost: 0.00, quantity: 1 })
            }, { enableBackdropDismiss: false });
            modal.onDidDismiss(item => {
              resolve(item);
            });
            modal.present();
          }
        }
      ];

      if(this.allowTemporaryAdd) {
        buttons.push({
          text: 'Yes (Temporary)',
          handler: () => {
            let modal = this.modalCtrl.create(InventoryManagerComponent, {
              stockItem: new StockItem({
                name: '',
                sku: query,
                taxable: false,
                cost: 0.00,
                quantity: 1,
                organizationalunitId: 1,
                temporary: true
              })
            }, { enableBackdropDismiss: false });
            modal.onDidDismiss(item => {
              resolve(item);
            });
            modal.present();
          }
        });
      }

      buttons.push({
        text: 'No',
        handler: () => resolve()
      });

      const confirm = this.alertCtrl.create({
        title: 'Item not found. Add item?',
        message: 'This item does not exist in your inventory, would you like to add it now?',
        buttons
      });

      confirm.present();
    });
  }

  handleIonChange($event: any) {
    this.handleQuery($event);
  }

  handleQuery($event: any) {
    if(_.isString($event)) {
      this.searchQuery = $event;

    // prevent multi-character keys from being added
    } else if($event.global && $event.key.length === 1) {
      this.searchQuery += $event.key;

      // don't bubble up to the global event if it's already been processed
      $event.stopPropagation();
      $event.preventDefault();

    } else if($event.key === 'Enter') {
      this.doSearch();

    } else if($event.key === 'Escape' || this.searchQuery === '') {
      this.cancelSearch();

    }
  }

  checkIfModalOnPage(): boolean {
    const nodes = document.getElementsByTagName('ion-modal');
    return nodes.length > 0;
  }

  ngOnDestroy() {
    this.globalListenKeypressRemover();
  }

  _itemSearch(query: string, force = false, callback?: Function): void {
    this.hasQuery.emit(this.showSearchResults());
    this.itemService
      .search(query)
      .toPromise()
      .then(items => {
        if(callback) { return callback(items); }
        return items;
      })
      .then(items => {
        this.searchResults.emit({ items, force });

        if(this.useSearchWindow && items.length > 1 && query) {
          const modal = this.modalCtrl.create(OmnisearchWindowComponent, {
            searchResults: items
          }, { enableBackdropDismiss: false });
          modal.onDidDismiss(item => {
            this.singleSearchItemResult.emit(item);
            this.searchQuery = '';
          });
          modal.present();
        }
      });
  }

  cancelSearch(): void {
    this.searchQuery = '';
    this.inputElement.value = '';
    this.searchItems = [];
    this.hasQuery.emit(false);
    this.searchResults.emit({ items: [] });
  }

  showSearchResults(): boolean {
    return !!this.searchQuery.trim();
  }
}

@Component({
  template: `
<ion-header>
  <ion-toolbar>
    <ion-title>
      Search Results
    </ion-title>
    <ion-buttons start>
      <button ion-button (click)="dismiss()">
        <span color="danger">Cancel</span>
      </button>
    </ion-buttons>
  </ion-toolbar>
</ion-header>

<ion-content>
  <ion-list>
    <ion-item *ngFor="let item of searchResults">
      <query-item [item]="item" (choose)="dismiss($event)"></query-item>
    </ion-item>
  </ion-list>
</ion-content>
`
})
export class OmnisearchWindowComponent implements OnInit {
  public searchResults: StockItem[] = [];

  constructor(public navParams: NavParams, public viewCtrl: ViewController) {}

  ngOnInit() {
    this.searchResults = this.navParams.get('searchResults');
  }

  dismiss(item?: StockItem) {
    this.viewCtrl.dismiss(item);
  }
}

@Component({
  selector: 'query-item',
  template: `
    <ion-grid no-padding>
      <ion-row>
        <ion-col width-60 no-padding>
          <ion-row>
            <ion-col no-padding>{{ item.name | truncate:50 }}</ion-col>
          </ion-row>
          <ion-row background-text>
            <ion-col no-padding>{{ item.description | truncate:50 }}</ion-col>
          </ion-row>
        </ion-col>
        <ion-col width-20 no-padding vertical-center>
          {{ item.sku }}
        </ion-col>
        <ion-col width-20 no-padding text-right>
          <button ion-button icon-only round no-margin (click)="choose.next(item)">
            <ion-icon name="checkmark-circle"></ion-icon>
          </button>
        </ion-col>
      </ion-row>
    </ion-grid>
`,
})
export class QueryItemComponent {
  @Input() item: StockItem;
  @Output() choose = new EventEmitter();
}
