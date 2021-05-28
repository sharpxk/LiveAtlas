/*
 * Copyright 2020 James Lyne
 *
 * Some portions of this file were taken from https://github.com/webbukkit/dynmap.
 * These portions are Copyright 2020 Dynmap Contributors.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

import {Util, Control, DomEvent, LeafletEvent, Map as LeafletMap, Layer, DomUtil} from 'leaflet';
import LayersObject = Control.LayersObject;
import LayersOptions = Control.LayersOptions;
import Layers = Control.Layers;

import '@/assets/icons/layers.svg';
import '@/assets/icons/checkbox.svg';
import {useStore} from "@/store";
import {MutationTypes} from "@/store/mutation-types";
import {watch} from "vue";
import {handleKeyboardEvent} from "@/util/events";

const store = useStore();

export class DynmapLayerControl extends Control.Layers {
	private _layersButton?: HTMLElement;
	private _map ?: LeafletMap;
	private _overlaysList?: HTMLElement;
	private _baseLayersList?: HTMLElement;
	private _layerControlInputs?: HTMLElement[];
	private _layerPositions: Map<Layer, number>;
	private _container?: HTMLElement;
	private _section?: HTMLElement;
	private _separator?: HTMLElement;
	private visible: boolean = false;

	constructor(baseLayers?: LayersObject, overlays?: LayersObject, options?: LayersOptions) {
		// noinspection JSUnusedGlobalSymbols
		super(baseLayers, overlays, Object.assign(options, {
			sortLayers: true,
			sortFunction: (layer1: Layer, layer2: Layer, name1: string, name2: string) => {
				const priority1 = this._layerPositions.get(layer1) || 0,
					priority2 = this._layerPositions.get(layer2) || 0;

				if(priority1 !== priority2) {
					return priority1 - priority2;
				}

				return ((name1 < name2) ? -1 : ((name1 > name2) ? 1 : 0));
			}
		}));
		this._layerPositions = new Map<Layer, number>();
	}

	hasLayer(layer: Layer): boolean {
		// @ts-ignore
		return !!super._getLayer(Util.stamp(layer));
	}

	expand() {
		this._layersButton!.setAttribute('aria-expanded', 'true');
		this._section!.style.display = '';
		this.handleResize();

		const firstCheckbox = this._container!.querySelector('input');

		if(firstCheckbox) {
			(firstCheckbox as HTMLElement).focus();
		}

		// @ts-ignore
		super._checkDisabledLayers();
		return this;
	}

	collapse() {
		this._layersButton!.setAttribute('aria-expanded', 'false');
		this._section!.style.display = 'none';

		return this;
	}

	_initLayout() {
		const className = 'leaflet-control-layers',
			container = this._container = DomUtil.create('div', className);

		DomEvent.disableClickPropagation(container);
		DomEvent.disableScrollPropagation(container);

		DomEvent.on(container, 'keydown', (e: Event) => {
			const elements = Array.from(container.querySelectorAll('input')) as HTMLElement[];
			handleKeyboardEvent(e as KeyboardEvent, elements);
		});

		const section = this._section = DomUtil.create('section', className + '-list'),
			button = this._layersButton = DomUtil.create('button', className + '-toggle', container);

		section.style.display = 'none';

		button.title = store.state.messages.layersTitle;
		button.setAttribute('aria-expanded', 'false');
		button.innerHTML = `
			<svg class="svg-icon" aria-hidden="true">
			  <use xlink:href="#icon--layers" />
			</svg>`;

		//Use vuex to toggle and track expanded state
		DomEvent.on(button,'click', () => store.commit(MutationTypes.TOGGLE_UI_ELEMENT_VISIBILITY, 'layers'));

		watch(store.state.ui.visibleElements, (newValue) => {
			if(newValue.has('layers') && !this.visible) {
				this.expand();
			} else if(this.visible && !newValue.has('layers')) {
				this.collapse();
			}

			this.visible = store.state.ui.visibleElements.has('layers');
		});

		watch(store.state.messages, (newValue) => (button.title = newValue.layersTitle));//

		this.visible = store.state.ui.visibleElements.has('layers');

		if (this.visible) {
			this.expand();
		}

		this._baseLayersList = DomUtil.create('div', className + '-base', section);
		this._separator = DomUtil.create('div', className + '-separator', section);
		this._overlaysList = DomUtil.create('div', className + '-overlays', section);

		container.appendChild(section);

		window.addEventListener('resize', () => this.handleResize());
		this.handleResize();
	}

	handleResize() {
		const y = this._layersButton!.getBoundingClientRect().y;

		//Limit height to remaining vertical space
		// Including 30px element padding, 10px padding from edge of viewport, and 55px padding to avoid covering bottom bar
		this._section!.style.maxHeight = `calc(100vh - ${(y + 30 + 10 + 55)}px)`;
	}

	addOverlayAtPosition(layer: Layer, name: string, position: number): this {
		this._layerPositions.set(layer, position);
		return super.addOverlay(layer, name);
	}

	addOverlay(layer: Layer, name: string): this {
		this._layerPositions.set(layer, 0);
		return super.addOverlay(layer, name);
	}

	removeLayer(layer: Layer): this {
		this._layerPositions.delete(layer);
		return super.removeLayer(layer);
	}

	// noinspection JSUnusedGlobalSymbols
	_addItem(obj: any) {
		const container = obj.overlay ? this._overlaysList : this._baseLayersList,
			item = document.createElement('label'),
			label = document.createElement('span'),
			checked = this._map!.hasLayer(obj.layer);

		let input;

		item.className = 'layer checkbox';

		if (obj.overlay) {
			input = document.createElement('input');
			input.type = 'checkbox';
			input.className = 'leaflet-control-layers-selector';
			input.defaultChecked = checked;
		} else {
			// @ts-ignore
			input = Layers.prototype._createRadioElement.call(this, 'leaflet-base-layers_' + Util.stamp(this), checked);
		}

		input.layerId = Util.stamp(obj.layer);
		this._layerControlInputs!.push(input);
		label.textContent = obj.name;

		// @ts-ignore
		DomEvent.on(input, 'click', (e: LeafletEvent) => Layers.prototype._onInputClick.call(this, e), this);

		item.appendChild(input);
		item.insertAdjacentHTML('beforeend',  `
		<svg class="svg-icon" aria-hidden="true">
	  		<use xlink:href="#icon--checkbox" />
		</svg>`);
		item.appendChild(label);

		container!.appendChild(item);

		// @ts-ignore
		Layers.prototype._checkDisabledLayers.call(this);
		return label;
	}
}
