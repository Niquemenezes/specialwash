import React, { useEffect, useRef, useState } from "react";
import getState from "./flux.js";

// Don't change, here is where we initialize our context, by default it's just going to be null.
export const Context = React.createContext(null);

// This function injects the global store to any view/component where you want to use it, we will inject the context to layout.js, you can see it here:
// https://github.com/SpecialWashAcademy/react-hello-webapp/blob/master/src/js/layout.js#L35
const injectContext = PassedComponent => {
	const StoreWrapper = props => {
		const [, forceRender] = useState(0);
		const stateRef = useRef(null);

		if (!stateRef.current) {
			const setStore = updatedStore => {
				const partialStore =
					typeof updatedStore === "function"
						? updatedStore(stateRef.current.store)
						: updatedStore;

				stateRef.current = {
					store: {
						...stateRef.current.store,
						...(partialStore || {}),
					},
					actions: stateRef.current.actions,
				};

				forceRender(value => value + 1);
			};

			stateRef.current = getState({
				getStore: () => stateRef.current.store,
				getActions: () => stateRef.current.actions,
				setStore,
			});
		}

		const state = stateRef.current;
		const getMessage = state?.actions?.getMessage;

			useEffect(() => {
				if (getMessage) getMessage();
			}, [getMessage]);

		
		// The initial value for the context is not null anymore, but the current state of this component,
		// the context will now have a getStore, getActions and setStore functions available, because they were declared
		// on the state of this component
		return (
			<Context.Provider value={state}>
				<PassedComponent {...props} />
			</Context.Provider>
		);
	};
	return StoreWrapper;
};

export default injectContext;